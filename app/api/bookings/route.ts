import { addDays, addHours, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getRequiredDepositPercent } from "@/lib/booking/risk";
import { sendAppointmentStatusEmail } from "@/lib/notifications/email";
import { createBusinessNotification } from "@/lib/notifications/in-app";
import { createBusinessNotification } from "@/lib/notifications/in-app";
import { getAdminSupabase } from "@/lib/supabase/admin";

const schema = z.object({
  businessId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  staffId: z.string().uuid().nullable(),
  startsAt: z.string().datetime(),
  clientEmail: z.string().email(),
  guestCount: z.number().int().min(0).max(1).default(0),
  businessDepositPercent: z.number().min(0).max(100)
});

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión para reservar." }, { status: 401 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: authData, error: authError } = await anon.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const user = authData.user;

  const supabase = getAdminSupabase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const safeEmail = profile?.email || user.email || parsed.data.clientEmail;

  const { data: stats } = await supabase
    .from("customer_global_stats")
    .select("risk_score")
    .eq("email", safeEmail)
    .maybeSingle();

  const globalRiskScore = stats?.risk_score ?? 0;
  const requiredDepositPercent = getRequiredDepositPercent({
    businessDepositPercent: parsed.data.businessDepositPercent,
    globalRiskScore,
    hasGlobalSoftBlacklist: false
  });

  const { data: services, error: serviceError } = await supabase
    .from("services")
    .select("id, name, price_cents, duration_min, buffer_before_min, buffer_after_min, requires_confirmation")
    .eq("business_id", parsed.data.businessId)
    .in("id", parsed.data.serviceIds);

  if (serviceError) return NextResponse.json({ error: serviceError.message }, { status: 400 });

  if (!services || services.length !== parsed.data.serviceIds.length) {
    return NextResponse.json({ error: "Servicios inválidos." }, { status: 400 });
  }

  const { data: policy } = await supabase
    .from("business_policies")
    .select("auto_confirm, booking_lead_days")
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();

  const leadDays = policy?.booking_lead_days ?? 0;
  const leadStart = leadDays > 0 ? startOfDay(addDays(new Date(), leadDays)) : new Date();
  if (new Date(parsed.data.startsAt) < leadStart) {
    return NextResponse.json({ error: `La cita debe reservarse con al menos ${leadDays} días de anticipación.` }, { status: 400 });
  }

  const basePrice = services.reduce((acc, item) => acc + (item.price_cents || 0), 0);
  const baseDuration = services.reduce((acc, item) => acc + (item.duration_min || 0), 0);
  const totalPriceCents = basePrice * (parsed.data.guestCount === 1 ? 2 : 1);
  const totalDurationMin = baseDuration * (parsed.data.guestCount === 1 ? 2 : 1);
  const requiresConfirmation = services.some((item) => item.requires_confirmation);

  const requiredDepositCents = Math.round(totalPriceCents * (requiredDepositPercent / 100));
  const endsAt = new Date(parsed.data.startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + totalDurationMin);

  const autoConfirm = policy?.auto_confirm ?? false;
  const status = !autoConfirm || requiresConfirmation
    ? "pending_confirmation"
    : requiredDepositPercent > 0
      ? "awaiting_payment"
      : "confirmed";

  const dueAt = status === "awaiting_payment" ? addHours(new Date(), 24).toISOString() : null;

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      business_id: parsed.data.businessId,
      service_id: services[0].id,
      staff_id: parsed.data.staffId,
      starts_at: parsed.data.startsAt,
      ends_at: endsAt.toISOString(),
      status,
      payment_due_at: dueAt,
      required_deposit_percent: requiredDepositPercent,
      required_deposit_cents: requiredDepositCents,
      total_price_cents: totalPriceCents,
      total_duration_min: totalDurationMin,
      guest_count: parsed.data.guestCount,
      customer_id: user.id,
      client_email: safeEmail
    })
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await createBusinessNotification({
    businessId: parsed.data.businessId,
    appointmentId: data.id,
    kind: "appointment_new",
    payload: {
      title: "Nueva cita",
      body: `Nueva solicitud de ${safeEmail}.`,
      status
    }
  });

  await supabase.from("appointment_services").insert(
    services.map((service, index) => ({
      appointment_id: data.id,
      service_id: service.id,
      price_cents: service.price_cents || 0,
      duration_min: service.duration_min || 0,
      sort_order: index * 10
    }))
  );

  await sendAppointmentStatusEmail({
    to: safeEmail,
    businessName: "Tu negocio",
    serviceName: services.map((item) => item.name).join(", "),
    startsAt: parsed.data.startsAt,
    status
  });

  const { data: businessOwner } = await supabase
    .from("businesses")
    .select("owner_id, name")
    .eq("id", parsed.data.businessId)
    .maybeSingle();

  if (businessOwner?.owner_id) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", businessOwner.owner_id)
      .maybeSingle();

    if (ownerProfile?.email) {
      await sendAppointmentStatusEmail({
        to: ownerProfile.email,
        businessName: businessOwner.name || "Tu negocio",
        serviceName: services.map((item) => item.name).join(", "),
        startsAt: parsed.data.startsAt,
        status
      });
    }
  }

  await createBusinessNotification({
    businessId: parsed.data.businessId,
    appointmentId: data.id,
    kind: "booking_request",
    payload: {
      title: "Nueva solicitud de cita",
      body: `Servicios: ${services.map((item) => item.name).join(", ")}`
    }
  });

  return NextResponse.json({ appointment: data });
}

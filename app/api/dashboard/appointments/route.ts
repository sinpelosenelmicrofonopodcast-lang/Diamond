import { addDays, endOfDay, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/server/dashboard-auth";
import { createBusinessNotification } from "@/lib/notifications/in-app";

const createSchema = z.object({
  service_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable(),
  starts_at: z.string().datetime(),
  client_email: z.string().email(),
  status: z
    .enum([
      "pending_confirmation",
      "confirmed",
      "awaiting_payment",
      "paid",
      "canceled_by_client",
      "canceled_by_business",
      "no_show",
      "completed"
    ])
    .default("confirmed")
});

export async function GET(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "today";

  const now = new Date();
  const rangeStart = mode === "week" ? startOfDay(now) : startOfDay(now);
  const rangeEnd = mode === "week" ? endOfDay(addDays(now, 6)) : endOfDay(now);

  const admin = getAdminSupabase();
  const { data, error: queryError } = await admin
    .from("appointments")
    .select("id, starts_at, status, client_email, customer_id, required_deposit_percent, required_deposit_cents, total_price_cents, external_payment_method, external_payment_status, external_payment_proof_url, services(name), staff_profiles(display_name)")
    .eq("business_id", ctx.businessId)
    .gte("starts_at", rangeStart.toISOString())
    .lte("starts_at", rangeEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 400 });

  const appointments = data || [];
  const emails = Array.from(new Set(appointments.map((item) => item.client_email).filter(Boolean)));
  const userIds = Array.from(new Set(appointments.map((item) => item.customer_id).filter(Boolean)));

  const [profilesRes, clientsRes] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, full_name, phone, avatar_url, email").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    emails.length
      ? admin
          .from("business_clients")
          .select("email, full_name, phone")
          .eq("business_id", ctx.businessId)
          .in("email", emails)
      : Promise.resolve({ data: [] as any[] })
  ]);

  const profileById = new Map((profilesRes.data || []).map((row: any) => [row.id, row]));
  const profileByEmail = new Map((profilesRes.data || []).map((row: any) => [row.email, row]));
  const clientByEmail = new Map((clientsRes.data || []).map((row: any) => [row.email, row]));

  const enriched = appointments.map((item: any) => {
    const byId = item.customer_id ? profileById.get(item.customer_id) : null;
    const byEmail = profileByEmail.get(item.client_email) || clientByEmail.get(item.client_email);
    const client = byId || byEmail;
    return {
      ...item,
      client_full_name: client?.full_name || null,
      client_phone: client?.phone || null,
      client_avatar_url: client?.avatar_url || null
    };
  });

  return NextResponse.json({ appointments: enriched });
}

export async function POST(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { data, error: insertError } = await admin
    .from("appointments")
    .insert({
      business_id: ctx.businessId,
      service_id: parsed.data.service_id,
      staff_id: parsed.data.staff_id,
      starts_at: parsed.data.starts_at,
      client_email: parsed.data.client_email,
      status: parsed.data.status,
      notes: "manual_block"
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  await createBusinessNotification({
    businessId: ctx.businessId,
    appointmentId: data.id,
    kind: "appointment_manual",
    payload: {
      title: "Cita manual",
      body: `Cita manual creada para ${parsed.data.client_email}.`,
      status: parsed.data.status
    }
  });
  return NextResponse.json({ appointment: data });
}

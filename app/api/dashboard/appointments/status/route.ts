import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/server/dashboard-auth";
import { sendAppointmentStatusEmail } from "@/lib/notifications/email";
import { createBusinessNotification } from "@/lib/notifications/in-app";

const schema = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum([
    "pending_confirmation",
    "confirmed",
    "awaiting_payment",
    "paid",
    "canceled_by_client",
    "canceled_by_business",
    "no_show",
    "completed"
  ])
});

export async function POST(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: appt, error: apptError } = await admin
    .from("appointments")
    .select("id, starts_at, paid_at, stripe_payment_intent, client_email")
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", ctx.businessId)
    .single();

  if (apptError || !appt) return NextResponse.json({ error: apptError?.message || "Cita no encontrada" }, { status: 400 });

  let patch: Record<string, unknown> = { status: parsed.data.status };

  if (parsed.data.status === "canceled_by_client") {
    const { data: policy } = await admin
      .from("business_policies")
      .select("min_cancel_minutes")
      .eq("business_id", ctx.businessId)
      .maybeSingle();

    const minCancelMinutes = policy?.min_cancel_minutes ?? 240;
    const minutesBefore = Math.floor((new Date(appt.starts_at).getTime() - Date.now()) / 60000);
    const refundable = minutesBefore >= minCancelMinutes;

    patch = {
      ...patch,
      canceled_at: new Date().toISOString(),
      cancel_reason: refundable
        ? `client_canceled_refundable_${minCancelMinutes}m`
        : `client_canceled_non_refundable_${minCancelMinutes}m`,
      external_payment_status: refundable ? "refund_eligible" : "non_refundable"
    };
  }

  const { error: updateError } = await admin
    .from("appointments")
    .update(patch)
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", ctx.businessId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await sendAppointmentStatusEmail({
    to: appt.client_email,
    businessName: "Tu negocio",
    serviceName: "Cita",
    startsAt: appt.starts_at,
    status: parsed.data.status
  });

  if (parsed.data.status === "canceled_by_client") {
    await createBusinessNotification({
      businessId: ctx.businessId,
      appointmentId: appt.id,
      kind: "appointment_canceled_by_client",
      payload: {
        title: "Cliente cancelo la cita",
        body: "El cliente cancelo la cita."
      }
    });
  }

  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", ctx.businessId)
    .eq("appointment_id", appt.id);

  return NextResponse.json({ ok: true, appointmentId: parsed.data.appointmentId });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/server/dashboard-auth";
import { sendAppointmentStatusEmail } from "@/lib/notifications/email";

const schema = z.object({
  appointmentId: z.string().uuid()
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
    .select("id, starts_at, client_email, total_price_cents, required_deposit_cents")
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", ctx.businessId)
    .single();

  if (apptError || !appt) return NextResponse.json({ error: apptError?.message || "Cita no encontrada" }, { status: 400 });

  const total = appt.total_price_cents || 0;
  const deposit = appt.required_deposit_cents || 0;
  const isFullPayment = total > 0 ? deposit >= total : false;
  const nextStatus = isFullPayment ? "paid" : "confirmed";

  const patch: Record<string, unknown> = {
    status: nextStatus,
    external_payment_status: "verified"
  };

  if (nextStatus === "paid") {
    patch.paid_at = new Date().toISOString();
  }

  const { error: updateError } = await admin
    .from("appointments")
    .update(patch)
    .eq("id", appt.id)
    .eq("business_id", ctx.businessId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await sendAppointmentStatusEmail({
    to: appt.client_email,
    businessName: "Tu negocio",
    serviceName: "Cita",
    startsAt: appt.starts_at,
    status: nextStatus
  });

  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", ctx.businessId)
    .eq("appointment_id", appt.id);

  return NextResponse.json({ ok: true, status: nextStatus });
}

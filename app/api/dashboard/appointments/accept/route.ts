import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/server/dashboard-auth";
import { sendAppointmentStatusEmail } from "@/lib/notifications/email";
import { createBusinessNotification } from "@/lib/notifications/in-app";

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
    .select("id, starts_at, required_deposit_percent, client_email")
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", ctx.businessId)
    .single();

  if (apptError || !appt) return NextResponse.json({ error: apptError?.message || "Cita no encontrada" }, { status: 400 });

  const nextStatus = appt.required_deposit_percent > 0 ? "awaiting_payment" : "confirmed";

  const { error: updateError } = await admin
    .from("appointments")
    .update({ status: nextStatus })
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

  await createBusinessNotification({
    businessId: ctx.businessId,
    appointmentId: appt.id,
    kind: "appointment_accepted",
    payload: {
      title: "Solicitud aceptada",
      body: `La cita fue aceptada y esta ${nextStatus}.`
    }
  });

  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", ctx.businessId)
    .eq("appointment_id", appt.id);

  return NextResponse.json({ ok: true, status: nextStatus });
}

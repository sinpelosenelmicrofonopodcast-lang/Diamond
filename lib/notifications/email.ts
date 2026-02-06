import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getFromAddress(kind: "bookings" | "reminders") {
  if (kind === "reminders") {
    return process.env.RESEND_REMINDERS_FROM || process.env.RESEND_FROM || null;
  }
  return process.env.RESEND_FROM || null;
}

interface AppointmentEmailInput {
  to: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
  status: string;
}

export async function sendAppointmentStatusEmail(input: AppointmentEmailInput) {
  const resend = getResend();
  const from = getFromAddress("bookings");
  if (!resend || !from) return { id: "skipped", error: "Missing RESEND_API_KEY or RESEND_FROM" };
  return resend.emails.send({
    from,
    to: input.to,
    subject: `Tu cita está ${input.status}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0B0B0F;color:#F7F7FB;padding:24px;border-radius:16px">
        <h2 style="color:#F5D77A">${input.businessName}</h2>
        <p>Servicio: ${input.serviceName}</p>
        <p>Fecha: ${new Date(input.startsAt).toLocaleString("es-US")}</p>
        <p>Estado: ${input.status}</p>
      </div>
    `
  });
}

export async function sendReminderEmail(input: AppointmentEmailInput, hoursBefore: 24 | 2) {
  const resend = getResend();
  const from = getFromAddress("reminders");
  if (!resend || !from) return { id: "skipped", error: "Missing RESEND_API_KEY or RESEND_FROM" };
  return resend.emails.send({
    from,
    to: input.to,
    subject: `Recordatorio: cita en ${hoursBefore}h`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#111118;color:#F7F7FB;padding:20px;border-radius:16px">
        <h3 style="color:#D4AF37">Nos vemos pronto</h3>
        <p>Tienes cita con ${input.businessName} para ${input.serviceName}.</p>
      </div>
    `
  });
}

export function buildSmsPlaceholder(message: string, to: string) {
  return {
    provider: "twilio-placeholder",
    to,
    message
  };
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getClientSupabase } from "@/lib/supabase/client";

type Appointment = {
  id: string;
  starts_at: string;
  status: string;
  client_email: string;
  client_full_name?: string | null;
  client_phone?: string | null;
  client_avatar_url?: string | null;
  required_deposit_percent: number;
  required_deposit_cents?: number | null;
  total_price_cents?: number | null;
  external_payment_method?: string | null;
  external_payment_status?: string | null;
  external_payment_proof_url?: string | null;
  services?: { name?: string } | null;
  staff_profiles?: { display_name?: string } | null;
};

type ServiceOption = { id: string; name: string };
type StaffOption = { id: string; display_name: string };

export default function AppointmentsPage() {
  const { locale, tx } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const quickActions = [
    [tx("Confirmar", "Confirm"), "confirmed"],
    [tx("Cancelar", "Cancel"), "canceled_by_business"],
    ["No-show", "no_show"],
    [tx("Completar", "Complete"), "completed"]
  ] as const;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    service_id: "",
    staff_id: "",
    starts_at: "",
    client_email: "",
    status: "confirmed"
  });

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadAppointments() {
    const res = await fetch("/api/dashboard/appointments?mode=today", { headers: await authHeaders() });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudieron cargar citas.", "Could not load appointments."));
    } else {
      setAppointments(payload.appointments || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAppointments();
    (async () => {
      const headers = await authHeaders();
      const [servicesRes, staffRes] = await Promise.all([
        fetch("/api/dashboard/services", { headers }),
        fetch("/api/dashboard/staff", { headers })
      ]);
      const [servicesPayload, staffPayload] = await Promise.all([servicesRes.json(), staffRes.json()]);
      if (servicesRes.ok) {
        const active = (servicesPayload.services || []).filter((item: any) => item.is_active);
        setServices(active);
        if (active.length > 0) setForm((prev) => ({ ...prev, service_id: active[0].id }));
      }
      if (staffRes.ok) setStaff(staffPayload.staff || []);
    })();
  }, []);

  async function createManualAppointment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    const res = await fetch("/api/dashboard/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders())
      },
      body: JSON.stringify({
        service_id: form.service_id,
        staff_id: form.staff_id || null,
        starts_at: new Date(form.starts_at).toISOString(),
        client_email: form.client_email,
        status: form.status
      })
    });

    const payload = await res.json();
    if (!res.ok) {
      setCreating(false);
      setMessage(payload.error || tx("No se pudo crear cita manual.", "Could not create manual appointment."));
      return;
    }

    setCreating(false);
    setMessage(tx("Cita manual creada y horario bloqueado.", "Manual appointment created and time blocked."));
    setForm((prev) => ({ ...prev, starts_at: "", client_email: "" }));
    await loadAppointments();
  }

  async function updateStatus(appointmentId: string, status: string) {
    const res = await fetch("/api/dashboard/appointments/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders())
      },
      body: JSON.stringify({ appointmentId, status })
    });

    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo actualizar estado.", "Could not update status."));
      return;
    }

    setMessage(tx("Estado actualizado.", "Status updated."));
    await loadAppointments();
  }

  async function acceptAppointment(appointmentId: string) {
    const res = await fetch("/api/dashboard/appointments/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ appointmentId })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo aceptar la cita.", "Could not accept appointment."));
      return;
    }
    setMessage(tx("Solicitud aceptada.", "Request accepted."));
    await loadAppointments();
  }

  async function rejectAppointment(appointmentId: string) {
    const res = await fetch("/api/dashboard/appointments/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ appointmentId })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo rechazar la cita.", "Could not reject appointment."));
      return;
    }
    setMessage(tx("Solicitud rechazada.", "Request rejected."));
    await loadAppointments();
  }

  async function confirmPayment(appointmentId: string) {
    const res = await fetch("/api/dashboard/appointments/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ appointmentId })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo confirmar el pago.", "Could not confirm payment."));
      return;
    }
    setMessage(tx("Pago confirmado.", "Payment confirmed."));
    await loadAppointments();
  }

  return (
    <>
      <h1 className="font-display text-4xl">{tx("Citas del día", "Today's appointments")}</h1>
      <Card>
        <h2 className="font-display text-2xl">{tx("Agregar cita manual (bloquear horario)", "Add manual appointment (block time)")}</h2>
        <p className="mt-1 text-sm text-mutedText">{tx("Crea citas desde el negocio para bloquear disponibilidad y sincronizar agenda.", "Create appointments from your business to block availability and sync your calendar.")}</p>
        <form className="mt-3 space-y-3" onSubmit={createManualAppointment}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-coolSilver">
              {tx("Servicio", "Service")}
              <select
                className="mt-1 h-11 w-full rounded-2xl border border-silver/20 bg-richBlack/80 px-3 text-textWhite"
                value={form.service_id}
                onChange={(e) => setForm((prev) => ({ ...prev, service_id: e.target.value }))}
                required
              >
                <option value="" disabled>{tx("Selecciona servicio", "Select service")}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-coolSilver">
              {tx("Staff (opcional)", "Staff (optional)")}
              <select
                className="mt-1 h-11 w-full rounded-2xl border border-silver/20 bg-richBlack/80 px-3 text-textWhite"
                value={form.staff_id}
                onChange={(e) => setForm((prev) => ({ ...prev, staff_id: e.target.value }))}
              >
                <option value="">{tx("Sin asignar", "Unassigned")}</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>{member.display_name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-coolSilver">
              {tx("Fecha y hora", "Date and time")}
              <Input className="mt-1" type="datetime-local" value={form.starts_at} onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))} required />
            </label>
            <label className="text-sm text-coolSilver">
              {tx("Email cliente", "Client email")}
              <Input className="mt-1" type="email" placeholder={tx("cliente@email.com", "client@email.com")} value={form.client_email} onChange={(e) => setForm((prev) => ({ ...prev, client_email: e.target.value }))} required />
            </label>
            <label className="text-sm text-coolSilver">
              {tx("Estado inicial", "Initial status")}
              <select
                className="mt-1 h-11 w-full rounded-2xl border border-silver/20 bg-richBlack/80 px-3 text-textWhite"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="confirmed">{tx("Confirmada", "Confirmed")}</option>
                <option value="awaiting_payment">{tx("Pendiente pago", "Awaiting payment")}</option>
                <option value="paid">{tx("Pagada", "Paid")}</option>
                <option value="pending_confirmation">{tx("Pendiente confirmación", "Pending confirmation")}</option>
              </select>
            </label>
          </div>

          <Button type="submit" disabled={creating}>{creating ? tx("Creando...", "Creating...") : tx("Agregar cita manual", "Add manual appointment")}</Button>
        </form>
      </Card>

      <Card>
        {loading ? <p className="text-coolSilver">{tx("Cargando citas...", "Loading appointments...")}</p> : null}
        <div className="space-y-2">
          {appointments.map((item) => (
            <div key={item.id} className="rounded-xl border border-silver/20 bg-black/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  {item.client_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.client_avatar_url}
                      alt={item.client_full_name || "Cliente"}
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-silver/20 text-xs text-coolSilver">
                      {item.client_full_name
                        ? item.client_full_name
                            .split(" ")
                            .map((chunk) => chunk[0])
                            .join("")
                            .slice(0, 2)
                        : "NA"}
                    </div>
                  )}
                  <div>
                  <p className="text-textWhite">
                    {new Date(item.starts_at).toLocaleTimeString(locale === "en" ? "en-US" : "es-US", { hour: "2-digit", minute: "2-digit" })} · {item.services?.name || tx("Servicio", "Service")}
                  </p>
                  <p className="text-mutedText">
                    {item.client_full_name || tx("Cliente", "Client")} · {item.client_email}
                  </p>
                  <p className="text-mutedText">
                    {item.client_phone ? `${item.client_phone} · ` : ""}
                    {tx("Staff", "Staff")}: {item.staff_profiles?.display_name || tx("Sin asignar", "Unassigned")}
                  </p>
                  </div>
                </div>
                <Badge>{item.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-coolSilver">{tx("Depósito requerido", "Required deposit")}: {item.required_deposit_percent}%</p>
              {item.external_payment_status === "submitted" && item.external_payment_proof_url ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-softGold">
                  <span>{tx("Pago reportado por el cliente", "Client reported payment")}</span>
                  <a
                    href={item.external_payment_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gold/30 px-2 py-1 text-xs text-softGold hover:bg-gold/10"
                  >
                    {tx("Ver comprobante", "View proof")}
                  </a>
                  <Button size="sm" onClick={() => confirmPayment(item.id)}>
                    {tx("Confirmar depósito", "Confirm deposit")}
                  </Button>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {item.status === "pending_confirmation" ? (
                  <>
                    <Button size="sm" onClick={() => acceptAppointment(item.id)}>
                      {tx("Aceptar solicitud", "Accept request")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => rejectAppointment(item.id)}>
                      {tx("Rechazar solicitud", "Reject request")}
                    </Button>
                  </>
                ) : null}
                {quickActions.map(([label, status]) => (
                  <Button key={`${item.id}-${status}`} size="sm" variant="secondary" onClick={() => updateStatus(item.id, status)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {message ? <p className="mt-3 text-sm text-coolSilver">{message}</p> : null}
      </Card>
    </>
  );
}

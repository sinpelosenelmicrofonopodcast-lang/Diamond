"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getClientSupabase } from "@/lib/supabase/client";

type ClientItem = {
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone?: string | null;
  notes?: string | null;
  is_frequent?: boolean;
  total_appointments: number;
  completed_count: number;
  no_show_count: number;
  strikes: number;
  force_prepay: boolean;
  soft_blacklist: boolean;
  blacklist_reason: string | null;
  last_appointment_at?: string | null;
  reminders?: Array<{
    id: string;
    note: string;
    remind_at?: string | null;
    created_at: string;
    status?: string;
  }>;
};

export default function ClientsPage() {
  const { tx, locale } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [reasonByEmail, setReasonByEmail] = useState<Record<string, string>>({});
  const [notesByEmail, setNotesByEmail] = useState<Record<string, string>>({});
  const [phoneByEmail, setPhoneByEmail] = useState<Record<string, string>>({});
  const [frequentByEmail, setFrequentByEmail] = useState<Record<string, boolean>>({});
  const [newClient, setNewClient] = useState({ email: "", full_name: "", phone: "" });
  const [reminderNoteByEmail, setReminderNoteByEmail] = useState<Record<string, string>>({});
  const [reminderDateByEmail, setReminderDateByEmail] = useState<Record<string, string>>({});

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadClients() {
    const res = await fetch("/api/dashboard/clients", { headers: await authHeaders() });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudieron cargar clientes.", "Could not load clients."));
    } else {
      setClients(payload.clients || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function updateClient(email: string, body: any) {
    const res = await fetch("/api/dashboard/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders())
      },
      body: JSON.stringify({ email, ...body })
    });

    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo actualizar cliente.", "Could not update client."));
      return;
    }

    setMessage(tx("Cliente actualizado.", "Client updated."));
    await loadClients();
  }

  async function createReminder(email: string) {
    const note = reminderNoteByEmail[email] || "";
    if (!note) {
      setMessage(tx("Nota requerida para el recordatorio.", "Reminder note required."));
      return;
    }
    const remindAt = reminderDateByEmail[email] ? new Date(reminderDateByEmail[email]).toISOString() : null;
    const res = await fetch("/api/dashboard/clients/reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders())
      },
      body: JSON.stringify({ client_email: email, note, remind_at: remindAt })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo crear el recordatorio.", "Could not create reminder."));
      return;
    }
    setReminderNoteByEmail((prev) => ({ ...prev, [email]: "" }));
    setReminderDateByEmail((prev) => ({ ...prev, [email]: "" }));
    setMessage(tx("Recordatorio creado.", "Reminder created."));
    await loadClients();
  }

  async function deleteClient(email: string) {
    const res = await fetch(`/api/dashboard/clients?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers: await authHeaders()
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo borrar el cliente.", "Could not delete client."));
      return;
    }
    setMessage(tx("Cliente eliminado de la base del negocio.", "Client removed from business database."));
    await loadClients();
  }

  function exportCsv() {
    const headers = [
      "email",
      "full_name",
      "phone",
      "total_appointments",
      "completed_count",
      "no_show_count",
      "strikes",
      "force_prepay",
      "soft_blacklist",
      "is_frequent",
      "last_appointment_at"
    ];
    const rows = clients.map((client) => [
      client.email,
      client.full_name,
      client.phone || "",
      String(client.total_appointments || 0),
      String(client.completed_count || 0),
      String(client.no_show_count || 0),
      String(client.strikes || 0),
      client.force_prepay ? "true" : "false",
      client.soft_blacklist ? "true" : "false",
      client.is_frequent ? "true" : "false",
      client.last_appointment_at || ""
    ]);
    const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "diamond_studio_clients.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <h1 className="font-display text-4xl">{tx("Clientes", "Clients")}</h1>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-coolSilver">{tx("Administra clientes, activa pre-pago forzado y soft blacklist por negocio.", "Manage clients, enable forced prepayment and soft blacklist by business.")}</p>
          <Button variant="secondary" onClick={exportCsv}>{tx("Exportar CSV", "Export CSV")}</Button>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <Input
            placeholder={tx("Email del cliente", "Client email")}
            value={newClient.email}
            onChange={(e) => setNewClient((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            placeholder={tx("Nombre del cliente", "Client name")}
            value={newClient.full_name}
            onChange={(e) => setNewClient((prev) => ({ ...prev, full_name: e.target.value }))}
          />
          <Input
            placeholder={tx("Teléfono", "Phone")}
            value={newClient.phone}
            onChange={(e) => setNewClient((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Button
            onClick={() => {
              if (!newClient.email) {
                setMessage(tx("Email requerido.", "Email required."));
                return;
              }
              updateClient(newClient.email, {
                full_name: newClient.full_name,
                phone: newClient.phone
              });
              setNewClient({ email: "", full_name: "", phone: "" });
            }}
          >
            {tx("Agregar cliente", "Add client")}
          </Button>
        </div>

        {loading ? <p className="text-coolSilver">{tx("Cargando clientes...", "Loading clients...")}</p> : null}

        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.email} className="rounded-xl border border-silver/20 bg-black/40 p-3">
              {(() => {
                const isVip = client.completed_count >= 5 || client.is_frequent;
                const isRisk = client.strikes >= 2 || client.no_show_count > 0 || client.soft_blacklist;
                const isNew = client.total_appointments <= 1;
                return (
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    {isVip ? <Badge className="bg-amber-500/10 text-amber-300">VIP</Badge> : null}
                    {isRisk ? <Badge className="bg-rose-500/10 text-rose-300">{tx("Riesgo", "Risk")}</Badge> : null}
                    {isNew ? <Badge className="bg-sky-500/10 text-sky-300">{tx("Nuevo", "New")}</Badge> : null}
                  </div>
                );
              })()}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {client.avatar_url ? (
                    <Image src={client.avatar_url} alt={client.full_name} width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/20 text-sm font-semibold text-softGold">
                      {(client.full_name || client.email)
                        .split(" ")
                        .map((v) => v[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-textWhite">{client.full_name}</p>
                    <p className="text-xs text-mutedText">{client.email}</p>
                    {client.phone ? <p className="text-xs text-mutedText">{client.phone}</p> : null}
                    <p className="text-xs text-coolSilver">
                      {tx("Citas", "Appointments")}: {client.total_appointments} · {tx("Completadas", "Completed")}: {client.completed_count} · No-show: {client.no_show_count}
                    </p>
                    {client.last_appointment_at ? (
                      <p className="text-xs text-coolSilver">
                        {tx("Última cita", "Last visit")}: {new Date(client.last_appointment_at).toLocaleDateString(locale === "en" ? "en-US" : "es-US")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge>Strikes: {client.strikes}</Badge>
                  {client.force_prepay ? <Badge className="bg-amber-500/10 text-amber-300">{tx("Pre-pago forzado", "Forced prepay")}</Badge> : null}
                  {client.soft_blacklist ? <Badge className="bg-rose-500/10 text-rose-300">{tx("Soft blacklist", "Soft blacklist")}</Badge> : null}
                  {client.is_frequent ? <Badge className="bg-emerald-500/10 text-emerald-300">{tx("Frecuente", "Frequent")}</Badge> : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <Input
                  placeholder={tx("Razón soft blacklist (opcional)", "Soft blacklist reason (optional)")}
                  value={reasonByEmail[client.email] ?? client.blacklist_reason ?? ""}
                  onChange={(e) => setReasonByEmail((prev) => ({ ...prev, [client.email]: e.target.value }))}
                />
                <Button
                  variant="secondary"
                  onClick={() => updateClient(client.email, { force_prepay: !client.force_prepay })}
                >
                  {client.force_prepay ? tx("Quitar pre-pago", "Remove prepay") : tx("Forzar pre-pago", "Force prepay")}
                </Button>
                <Button
                  variant={client.soft_blacklist ? "danger" : "secondary"}
                  onClick={() =>
                    updateClient(client.email, {
                      soft_blacklist: !client.soft_blacklist,
                      reason: reasonByEmail[client.email] ?? client.blacklist_reason ?? null
                    })
                  }
                >
                  {client.soft_blacklist ? tx("Quitar blacklist", "Remove blacklist") : tx("Soft blacklist", "Soft blacklist")}
                </Button>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  placeholder={tx("Notas internas", "Internal notes")}
                  value={notesByEmail[client.email] ?? client.notes ?? ""}
                  onChange={(e) => setNotesByEmail((prev) => ({ ...prev, [client.email]: e.target.value }))}
                />
                <Input
                  placeholder={tx("Teléfono", "Phone")}
                  value={phoneByEmail[client.email] ?? client.phone ?? ""}
                  onChange={(e) => setPhoneByEmail((prev) => ({ ...prev, [client.email]: e.target.value }))}
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    updateClient(client.email, {
                      notes: notesByEmail[client.email] ?? client.notes ?? "",
                      phone: phoneByEmail[client.email] ?? client.phone ?? "",
                      is_frequent: frequentByEmail[client.email] ?? client.is_frequent ?? false
                    })
                  }
                >
                  {tx("Guardar", "Save")}
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-coolSilver">
                  <input
                    type="checkbox"
                    checked={frequentByEmail[client.email] ?? client.is_frequent ?? false}
                    onChange={(e) => setFrequentByEmail((prev) => ({ ...prev, [client.email]: e.target.checked }))}
                  />
                  {tx("Cliente frecuente", "Frequent client")}
                </label>
                <Button variant="danger" size="sm" onClick={() => deleteClient(client.email)}>
                  {tx("Borrar cliente", "Delete client")}
                </Button>
              </div>

              <div className="mt-4 rounded-2xl border border-silver/20 bg-black/40 p-3">
                <p className="text-sm text-softGold">{tx("Recordatorios", "Reminders")}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_220px_auto]">
                  <Input
                    placeholder={tx("Nota del recordatorio", "Reminder note")}
                    value={reminderNoteByEmail[client.email] ?? ""}
                    onChange={(e) => setReminderNoteByEmail((prev) => ({ ...prev, [client.email]: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    value={reminderDateByEmail[client.email] ?? ""}
                    onChange={(e) => setReminderDateByEmail((prev) => ({ ...prev, [client.email]: e.target.value }))}
                  />
                  <Button variant="secondary" onClick={() => createReminder(client.email)}>
                    {tx("Crear recordatorio", "Create reminder")}
                  </Button>
                </div>
                {client.reminders && client.reminders.length > 0 ? (
                  <div className="mt-3 space-y-2 text-xs text-coolSilver">
                    {client.reminders.slice(0, 3).map((reminder) => (
                      <div key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-silver/10 bg-richBlack/60 px-3 py-2">
                        <span className="text-textWhite">{reminder.note}</span>
                        <span>
                          {reminder.remind_at
                            ? new Date(reminder.remind_at).toLocaleString(locale === "en" ? "en-US" : "es-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : tx("Sin fecha", "No date")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-mutedText">{tx("Aun no hay recordatorios.", "No reminders yet.")}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {message ? <p className="mt-3 text-sm text-coolSilver">{message}</p> : null}
      </Card>
    </>
  );
}

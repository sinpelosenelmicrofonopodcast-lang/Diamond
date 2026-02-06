"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import { getClientSupabase } from "@/lib/supabase/client";

type Appointment = {
  id: string;
  starts_at: string;
  status: string;
  client_email: string;
  client_full_name?: string | null;
  client_phone?: string | null;
  client_avatar_url?: string | null;
  services?: { name?: string } | null;
};

const dayNames = {
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

const statusStyles: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  awaiting_payment: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  pending_confirmation: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  completed: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  canceled_by_business: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  canceled_by_client: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  no_show: "bg-red-500/15 text-red-300 border-red-400/30"
};

const statusLabels = {
  pending_confirmation: { es: "Pendiente", en: "Pending" },
  confirmed: { es: "Confirmada", en: "Confirmed" },
  awaiting_payment: { es: "Pago pendiente", en: "Awaiting payment" },
  paid: { es: "Pagada", en: "Paid" },
  canceled_by_client: { es: "Cancelada cliente", en: "Canceled by client" },
  canceled_by_business: { es: "Cancelada negocio", en: "Canceled by business" },
  no_show: { es: "No show", en: "No show" },
  completed: { es: "Completada", en: "Completed" }
} as const;

const formatStatus = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function CalendarPage() {
  const { locale, tx } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeZone, setTimeZone] = useState<string | null>(null);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/dashboard/appointments?mode=week", { headers: await authHeaders() });
      const payload = await res.json();
      if (res.ok) {
        setAppointments(payload.appointments || []);
        setTimeZone(payload.timezone || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  const grouped = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const items = appointments.filter((item) => {
      const d = new Date(item.starts_at);
      return d.toLocaleDateString("en-CA", { timeZone: timeZone || undefined }) === date.toLocaleDateString("en-CA", { timeZone: timeZone || undefined });
    });
    return { date, items };
  });

  const weekTotal = grouped.reduce((acc, day) => acc + day.items.length, 0);
  const busiestDay = grouped
    .map((day) => ({ label: dayNames[locale][day.date.getDay()], count: day.items.length }))
    .sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl">{tx("Calendario semanal", "Weekly calendar")}</h1>
        <div className="flex gap-2">
          <Badge className="bg-gold/10 text-softGold">{weekTotal} {tx("citas esta semana", "appointments this week")}</Badge>
          <Badge className="bg-silver/10 text-coolSilver">
            {tx("Día más cargado", "Busiest day")}: {busiestDay?.label || "-"} ({busiestDay?.count || 0})
          </Badge>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-gold/20 bg-gradient-to-r from-gold/10 to-transparent px-4 py-3">
          <p className="text-sm text-coolSilver">{tx("Vista premium semanal", "Premium weekly view")}</p>
        </div>

        {loading ? (
          <div className="p-4 text-coolSilver">{tx("Cargando calendario...", "Loading calendar...")}</div>
        ) : (
          <div className="overflow-x-auto p-3">
            <div className="grid min-w-[980px] grid-cols-7 gap-3">
              {grouped.map(({ date, items }, idx) => (
                <div key={idx} className="rounded-2xl border border-silver/20 bg-black/40 p-3">
                  <div className="mb-3 border-b border-silver/15 pb-2">
                    <p className="text-xs uppercase tracking-wider text-mutedText">{dayNames[locale][date.getDay()]}</p>
                    <p className="font-display text-xl text-textWhite">
                      {date.getMonth() + 1}/{date.getDate()}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {items.length === 0 ? <p className="text-xs text-coolSilver">{tx("Sin citas", "No appointments")}</p> : null}
                    {items.map((item) => {
                      const time = new Date(item.starts_at).toLocaleTimeString(locale === "en" ? "en-US" : "es-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: timeZone || undefined
                      });
                      const initials = item.client_full_name
                        ? item.client_full_name
                            .split(" ")
                            .map((chunk) => chunk[0])
                            .join("")
                            .slice(0, 2)
                        : "NA";
                      return (
                        <div key={item.id} className="rounded-2xl border border-gold/20 bg-gradient-to-r from-gold/10 to-transparent p-3 text-xs text-coolSilver">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-softGold">{time}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyles[item.status] || "bg-silver/10 text-coolSilver border-silver/30"}`}>
                              {statusLabels[String(item.status || "").toLowerCase() as keyof typeof statusLabels]?.[locale] || formatStatus(String(item.status || ""))}
                            </span>
                          </div>
                          <p className="mt-2 text-textWhite">{item.services?.name || tx("Servicio", "Service")}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {item.client_avatar_url ? (
                              <img src={item.client_avatar_url} alt={item.client_full_name || "Cliente"} className="h-7 w-7 rounded-lg object-cover" />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-silver/20 text-[10px] text-coolSilver">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-textWhite">{item.client_full_name || tx("Cliente", "Client")}</p>
                              {item.client_phone ? (
                                <p className="truncate text-[10px] text-mutedText">{item.client_phone}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

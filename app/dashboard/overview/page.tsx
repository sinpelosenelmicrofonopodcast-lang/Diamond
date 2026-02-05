 "use client";

import { useEffect, useMemo, useState } from "react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/components/providers/locale-provider";
import { getClientSupabase } from "@/lib/supabase/client";

export default function DashboardOverviewPage() {
  const { locale, tx } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    yesterdayAppointments: 0,
    noShowToday: 0,
    depositsToday: 0,
    deltaAppointments: 0,
    paidRevenueToday: 0,
    pendingRevenueToday: 0,
    estimatedRevenueToday: 0
  });
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    kind: string;
    payload?: { title?: string; body?: string };
    created_at: string;
    read_at?: string | null;
  }>>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [paymentsSummary, setPaymentsSummary] = useState<{
    deposit_mode?: string;
    base_deposit_percent?: number;
    fixed_deposit_cents?: number | null;
    pay_later_allowed?: boolean;
    external_payments_enabled?: boolean;
    accepted_methods?: string[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/dashboard/overview", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const payload = await res.json();
      if (res.ok) setStats(payload);

      const alertsRes = await fetch("/api/dashboard/alerts", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const alertsPayload = await alertsRes.json();
      if (alertsRes.ok) setAlerts(alertsPayload.alerts || []);
      setAlertsLoading(false);

      const paymentsRes = await fetch("/api/dashboard/payments", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const paymentsPayload = await paymentsRes.json();
      if (paymentsRes.ok) {
        setPaymentsSummary(paymentsPayload.payments || null);
      }
    })();
  }, [supabase]);

  const deltaLabel = stats.deltaAppointments === 0
    ? tx("sin cambio vs ayer", "no change vs yesterday")
    : `${stats.deltaAppointments > 0 ? "+" : ""}${stats.deltaAppointments}% ${tx("vs ayer", "vs yesterday")}`;

  return (
    <>
      <h1 className="font-display text-4xl">{tx("Overview de hoy", "Today's overview")}</h1>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title={tx("Citas hoy", "Today's appointments")} value={`${stats.todayAppointments}`} subtitle={deltaLabel} />
        <KpiCard title={tx("Ingresos estimados", "Estimated revenue")} value={`$${(stats.estimatedRevenueToday / 100).toFixed(2)}`} subtitle={tx("basado en reservas activas", "based on active bookings")} />
        <KpiCard title={tx("Pagadas", "Paid")} value={`$${(stats.paidRevenueToday / 100).toFixed(2)}`} subtitle={tx("confirmadas", "confirmed")} />
        <KpiCard title={tx("Pendientes", "Pending")} value={`$${(stats.pendingRevenueToday / 100).toFixed(2)}`} subtitle={tx("por cobrar", "to collect")} />
      </div>

      <Card>
        <h2 className="font-display text-2xl">{tx("Acciones rápidas", "Quick actions")}</h2>
        <div className="mt-3">
          <QuickActions />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Opciones de pago activas", "Active payment options")}</h2>
        {!paymentsSummary ? (
          <p className="mt-3 text-sm text-coolSilver">{tx("Cargando opciones de pago...", "Loading payment options...")}</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-coolSilver">
            <p>
              {tx("Modo de depósito", "Deposit mode")}: <span className="text-textWhite">{paymentsSummary.deposit_mode || "none"}</span>
            </p>
            <p>
              {tx("Depósito base", "Base deposit")}: <span className="text-textWhite">{paymentsSummary.base_deposit_percent ?? 0}%</span>
            </p>
            <p>
              {tx("Depósito fijo", "Fixed deposit")}: <span className="text-textWhite">${((paymentsSummary.fixed_deposit_cents || 0) / 100).toFixed(2)}</span>
            </p>
            <p>
              {tx("Pagar después", "Pay later")}: <span className="text-textWhite">{paymentsSummary.pay_later_allowed ? tx("Sí", "Yes") : tx("No", "No")}</span>
            </p>
            <p>
              {tx("Pagos externos", "External payments")}: <span className="text-textWhite">{paymentsSummary.external_payments_enabled ? tx("Sí", "Yes") : tx("No", "No")}</span>
            </p>
            <p>
              {tx("Métodos aceptados", "Accepted methods")}:{" "}
              <span className="text-textWhite">
                {(paymentsSummary.accepted_methods || []).length ? paymentsSummary.accepted_methods?.join(", ") : tx("Sin métodos activos", "No active methods")}
              </span>
            </p>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{tx("Panel de alertas", "Alerts panel")}</h2>
        </div>
        {alertsLoading ? (
          <p className="mt-3 text-sm text-coolSilver">{tx("Cargando alertas...", "Loading alerts...")}</p>
        ) : alerts.length === 0 ? (
          <p className="mt-3 text-sm text-coolSilver">{tx("No hay alertas nuevas.", "No new alerts.")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {alerts.slice(0, 8).map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-silver/20 bg-black/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-textWhite">{alert.payload?.title || alert.kind}</p>
                  <span className="text-xs text-mutedText">
                    {new Date(alert.created_at).toLocaleString(locale === "en" ? "en-US" : "es-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {alert.payload?.body ? <p className="mt-1 text-xs text-coolSilver">{alert.payload.body}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

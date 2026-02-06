 "use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/providers/locale-provider";
import { getClientSupabase } from "@/lib/supabase/client";

type AppointmentItem = {
  id: string;
  starts_at: string;
  status: string;
  required_deposit_cents: number | null;
  total_price_cents: number | null;
  external_payment_status?: string | null;
  external_payment_proof_url?: string | null;
  external_payment_method?: string | null;
  businesses?: { id: string; name: string; slug: string; logo_url?: string | null } | null;
};

export default function ClientAppointmentsPage() {
  const { tx, locale } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [methodsByBusiness, setMethodsByBusiness] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [methodById, setMethodById] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);

  const statusMeta: Record<string, { label: string; className: string }> = {
    pending_confirmation: { label: tx("Pendiente confirmación", "Pending confirmation"), className: "bg-amber-500/10 text-amber-300 border-amber-400/30" },
    confirmed: { label: tx("Confirmada", "Confirmed"), className: "bg-emerald-500/10 text-emerald-300 border-emerald-400/30" },
    awaiting_payment: { label: tx("Pendiente pago", "Awaiting payment"), className: "bg-gold/10 text-softGold border-gold/40" },
    paid: { label: tx("Pagada", "Paid"), className: "bg-sky-500/10 text-sky-300 border-sky-400/30" },
    canceled_by_client: { label: tx("Cancelada por cliente", "Canceled by client"), className: "bg-rose-500/10 text-rose-300 border-rose-400/30" },
    canceled_by_business: { label: tx("Cancelada por negocio", "Canceled by business"), className: "bg-rose-500/10 text-rose-300 border-rose-400/30" },
    no_show: { label: tx("No show", "No show"), className: "bg-rose-500/10 text-rose-300 border-rose-400/30" },
    completed: { label: tx("Completada", "Completed"), className: "bg-indigo-500/10 text-indigo-300 border-indigo-400/30" }
  };
  const formatStatus = (value: string) =>
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadAppointments() {
    const res = await fetch("/api/client/appointments", { headers: await authHeaders() });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudieron cargar tus citas.", "Could not load your appointments."));
    } else {
      setAppointments(payload.appointments || []);
      setMethodsByBusiness(payload.methodsByBusiness || {});
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function submitProof(appointmentId: string, businessId: string, file: File) {
    try {
      setUploadingId(appointmentId);
      setMessage(null);
      const formData = new FormData();
      formData.append("appointmentId", appointmentId);
      formData.append("method", methodById[appointmentId] || "");
      formData.append("file", file);

      const res = await fetch("/api/client/appointments/payment-proof", {
        method: "POST",
        headers: await authHeaders(),
        body: formData
      });

      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || tx("No se pudo enviar el comprobante.", "Could not submit proof."));
        return;
      }

      setMessage(tx("Comprobante enviado. El negocio lo confirmará.", "Proof sent. The business will confirm it."));
      await loadAppointments();
    } finally {
      setUploadingId(null);
    }
  }

  async function startStripePayment(appointmentId: string, businessId: string, amountCents: number) {
    try {
      setPayingId(appointmentId);
      setMessage(null);
      const { data } = await supabase.auth.getSession();
      const customerEmail = data.session?.user?.email;
      if (!customerEmail) {
        setMessage(tx("Debes iniciar sesión para pagar.", "You must be signed in to pay."));
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "deposit",
          amountCents,
          appointmentId,
          businessId,
          customerEmail
        })
      });

      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || tx("No se pudo iniciar el pago.", "Could not start payment."));
        return;
      }

      if (payload.url) {
        window.location.href = payload.url;
      }
    } finally {
      setPayingId(null);
    }
  }

  return (
    <Card>
      <h1 className="font-display text-3xl">{tx("Mis citas activas", "My active appointments")}</h1>
      {loading ? <p className="mt-4 text-coolSilver">{tx("Cargando...", "Loading...")}</p> : null}
      <div className="mt-4 space-y-3">
        {appointments.map((item) => {
          const business = item.businesses;
          const methods = business?.id ? methodsByBusiness[business.id] || [] : [];
          const hasStripe = methods.some((m: any) => m.method === "stripe");
          const deposit = item.required_deposit_cents || 0;
          const total = item.total_price_cents || 0;
          const normalizedStatus = String(item.status || "").toLowerCase();
          const statusView = statusMeta[normalizedStatus] || {
            label: formatStatus(normalizedStatus || item.status),
            className: "bg-silver/10 text-coolSilver border-silver/30"
          };
          return (
            <div key={item.id} className="rounded-xl border border-silver/20 bg-black/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {business?.logo_url ? (
                    <img src={business.logo_url} alt={business.name} className="h-12 w-12 rounded-2xl object-cover" />
                  ) : null}
                  <div>
                    <p className="text-textWhite">{business?.name || "-"}</p>
                    <p className="text-sm text-mutedText">
                      {new Date(item.starts_at).toLocaleString(locale === "en" ? "en-US" : "es-US")}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${statusView.className}`}>
                  {statusView.label}
                </span>
              </div>

              <div className="mt-2 text-sm text-coolSilver">
                <p>{tx("Total", "Total")}: ${(total / 100).toFixed(2)}</p>
                {deposit > 0 ? (
                  <p className="text-softGold">{tx("Depósito requerido", "Required deposit")}: ${(deposit / 100).toFixed(2)}</p>
                ) : null}
              </div>

              {item.status === "awaiting_payment" ? (
                <div className="mt-3 space-y-2">
                  {hasStripe ? (
                    <div className="flex flex-wrap gap-2">
                      {deposit > 0 ? (
                        <Button
                          variant="lux"
                          disabled={payingId === item.id}
                          onClick={() => business?.id && startStripePayment(item.id, business.id, deposit)}
                        >
                          {tx("Pagar depósito", "Pay deposit")}
                        </Button>
                      ) : null}
                      {total > 0 && total !== deposit ? (
                        <Button
                          variant="outline"
                          disabled={payingId === item.id}
                          onClick={() => business?.id && startStripePayment(item.id, business.id, total)}
                        >
                          {tx("Pagar total", "Pay full amount")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="text-sm text-softGold">
                    {tx("Indica que ya pagaste el depósito", "Let us know you paid the deposit")}
                  </p>
                  {methods.length ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {methods.map((m: any) => (
                          <button
                            key={`${item.id}-${m.method}`}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs ${methodById[item.id] === m.method ? "border-gold/60 text-softGold" : "border-silver/30 text-coolSilver"}`}
                            onClick={() => setMethodById((prev) => ({ ...prev, [item.id]: m.method }))}
                          >
                            {m.method}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-coolSilver">{tx("Este negocio no configuró métodos de pago externos.", "This business has not configured external payment methods.")}</p>
                  )}
                  <label className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-silver/20 bg-richBlack/80 px-4 py-3 text-sm text-coolSilver hover:border-softGold">
                    <span>{tx("Subir comprobante", "Upload proof")}</span>
                    <span className="rounded-xl border border-gold/30 px-3 py-1 text-xs text-softGold">{tx("Elegir archivo", "Choose file")}</span>
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*"
                      disabled={uploadingId === item.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || !business?.id) return;
                        submitProof(item.id, business.id, file);
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {message ? <p className="mt-3 text-sm text-coolSilver">{message}</p> : null}
    </Card>
  );
}

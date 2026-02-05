"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/providers/locale-provider";
import { getClientSupabase } from "@/lib/supabase/client";

type BusinessItem = {
  id: string;
  name: string;
  slug: string;
  city: string;
  category: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  created_at: string;
  is_active: boolean;
  plan: string;
  interval: string | null;
  subscription_status: string | null;
};

export default function AdminPage() {
  const { tx } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [transferBusinessId, setTransferBusinessId] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [suspendEmail, setSuspendEmail] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [globalBlacklistEmail, setGlobalBlacklistEmail] = useState("");
  const [globalBlacklistReason, setGlobalBlacklistReason] = useState("");
  const [auditLogs, setAuditLogs] = useState<Array<any>>([]);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadBusinesses() {
    const res = await fetch("/api/admin/overview", { headers: await authHeaders() });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudieron cargar negocios.", "Could not load businesses."));
    } else {
      setBusinesses(payload.businesses || []);
    }
    setLoading(false);
  }

  async function loadAudit() {
    const res = await fetch("/api/admin/audit", { headers: await authHeaders() });
    const payload = await res.json();
    if (res.ok) setAuditLogs(payload.logs || []);
  }

  useEffect(() => {
    loadBusinesses();
    loadAudit();
  }, []);

  async function transferBusiness() {
    if (!transferBusinessId || !transferEmail) {
      setMessage(tx("Completa negocio y email.", "Provide business and email."));
      return;
    }
    const res = await fetch("/api/admin/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ businessId: transferBusinessId, newOwnerEmail: transferEmail })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo transferir.", "Could not transfer."));
      return;
    }
    setMessage(tx("Transferencia completada.", "Transfer completed."));
    setTransferBusinessId("");
    setTransferEmail("");
    await loadBusinesses();
  }

  async function updateBusiness(businessId: string, patch: { isActive?: boolean; plan?: string; interval?: string | null }) {
    const res = await fetch("/api/admin/business/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ businessId, ...patch })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo actualizar.", "Could not update."));
      return;
    }
    setMessage(tx("Negocio actualizado.", "Business updated."));
    await loadBusinesses();
  }

  async function resetUserPassword() {
    if (!resetEmail || !resetPassword) {
      setMessage(tx("Completa email y contraseña.", "Provide email and password."));
      return;
    }
    const res = await fetch("/api/admin/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ email: resetEmail, password: resetPassword })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo resetear.", "Could not reset."));
      return;
    }
    setMessage(tx("Contraseña reseteada.", "Password reset."));
    setResetEmail("");
    setResetPassword("");
  }

  async function updateUser() {
    if (!suspendEmail) {
      setMessage(tx("Email requerido.", "Email required."));
      return;
    }
    const res = await fetch("/api/admin/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ email: suspendEmail, suspend: true })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo suspender.", "Could not suspend."));
      return;
    }
    setMessage(tx("Usuario suspendido.", "User suspended."));
    setSuspendEmail("");
    await loadAudit();
  }

  async function verifyEmail() {
    if (!suspendEmail) {
      setMessage(tx("Email requerido.", "Email required."));
      return;
    }
    const res = await fetch("/api/admin/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ email: suspendEmail, verifyEmail: true })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo verificar.", "Could not verify."));
      return;
    }
    setMessage(tx("Email verificado.", "Email verified."));
    setSuspendEmail("");
    await loadAudit();
  }

  async function sendBroadcast() {
    if (!broadcastTitle || !broadcastBody) {
      setMessage(tx("Completa titulo y mensaje.", "Provide title and message."));
      return;
    }
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ title: broadcastTitle, body: broadcastBody })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo enviar.", "Could not send."));
      return;
    }
    setMessage(tx("Broadcast enviado.", "Broadcast sent."));
    setBroadcastTitle("");
    setBroadcastBody("");
    await loadAudit();
  }

  async function updateGlobalBlacklist(active: boolean) {
    if (!globalBlacklistEmail) {
      setMessage(tx("Email requerido.", "Email required."));
      return;
    }
    const res = await fetch("/api/admin/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ email: globalBlacklistEmail, reason: globalBlacklistReason || null, active })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo actualizar.", "Could not update."));
      return;
    }
    setMessage(active ? tx("Email bloqueado global.", "Email globally blocked.") : tx("Email desbloqueado.", "Email unblocked."));
    setGlobalBlacklistEmail("");
    setGlobalBlacklistReason("");
    await loadAudit();
  }

  function exportCsv() {
    window.location.href = "/api/admin/export";
  }

  const filteredBusinesses = businesses.filter((biz) => {
    const q = search.toLowerCase();
    const matchesQuery = !q || [biz.name, biz.slug, biz.city, biz.category, biz.owner_email || ""].some((v) => String(v).toLowerCase().includes(q));
    const matchesPlan = filterPlan === "all" || biz.plan === filterPlan;
    const matchesStatus = filterStatus === "all" || (filterStatus === "active" ? biz.is_active : !biz.is_active);
    return matchesQuery && matchesPlan && matchesStatus;
  });

  return (
    <>
      <h1 className="font-display text-4xl">{tx("Admin global", "Global admin")}</h1>
      <Card>
        <h2 className="font-display text-2xl">{tx("Transferir negocio", "Transfer business")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder={tx("ID del negocio", "Business ID")}
            value={transferBusinessId}
            onChange={(e) => setTransferBusinessId(e.target.value)}
          />
          <Input
            placeholder={tx("Email nuevo dueño", "New owner email")}
            value={transferEmail}
            onChange={(e) => setTransferEmail(e.target.value)}
          />
          <Button onClick={transferBusiness}>{tx("Transferir", "Transfer")}</Button>
        </div>
        {message ? <p className="mt-3 text-sm text-coolSilver">{message}</p> : null}
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Resetear contraseña", "Reset password")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder={tx("Email del usuario", "User email")}
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />
          <Input
            placeholder={tx("Nueva contraseña", "New password")}
            type="password"
            minLength={6}
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
          <Button onClick={resetUserPassword}>{tx("Resetear", "Reset")}</Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Usuarios", "Users")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <Input
            placeholder={tx("Email del usuario", "User email")}
            value={suspendEmail}
            onChange={(e) => setSuspendEmail(e.target.value)}
          />
          <Button variant="secondary" onClick={verifyEmail}>{tx("Verificar email", "Verify email")}</Button>
          <Button variant="danger" onClick={updateUser}>{tx("Suspender", "Suspend")}</Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Blacklist global", "Global blacklist")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
          <Input
            placeholder={tx("Email", "Email")}
            value={globalBlacklistEmail}
            onChange={(e) => setGlobalBlacklistEmail(e.target.value)}
          />
          <Input
            placeholder={tx("Razón (opcional)", "Reason (optional)")}
            value={globalBlacklistReason}
            onChange={(e) => setGlobalBlacklistReason(e.target.value)}
          />
          <Button variant="danger" onClick={() => updateGlobalBlacklist(true)}>{tx("Bloquear", "Block")}</Button>
          <Button variant="secondary" onClick={() => updateGlobalBlacklist(false)}>{tx("Desbloquear", "Unblock")}</Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Broadcast", "Broadcast")}</h2>
        <div className="mt-3 grid gap-2">
          <Input
            placeholder={tx("Título", "Title")}
            value={broadcastTitle}
            onChange={(e) => setBroadcastTitle(e.target.value)}
          />
          <Input
            placeholder={tx("Mensaje", "Message")}
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
          />
          <Button onClick={sendBroadcast}>{tx("Enviar", "Send")}</Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Negocios", "Businesses")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_160px_auto]">
          <Input
            placeholder={tx("Buscar por nombre, ciudad, owner", "Search by name, city, owner")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="h-11 rounded-xl border border-silver/20 bg-richBlack/80 px-3 text-sm text-textWhite"
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
          >
            <option value="all">{tx("Todos los planes", "All plans")}</option>
            <option value="free">Free</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="black">Black</option>
          </select>
          <select
            className="h-11 rounded-xl border border-silver/20 bg-richBlack/80 px-3 text-sm text-textWhite"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">{tx("Todos los estados", "All status")}</option>
            <option value="active">{tx("Activos", "Active")}</option>
            <option value="inactive">{tx("Inactivos", "Inactive")}</option>
          </select>
          <Button variant="secondary" onClick={exportCsv}>{tx("Exportar CSV", "Export CSV")}</Button>
        </div>
        {loading ? <p className="text-coolSilver">{tx("Cargando...", "Loading...")}</p> : null}
        <div className="mt-3 space-y-2 text-sm text-coolSilver">
          {filteredBusinesses.map((biz) => (
            <div key={biz.id} className="rounded-2xl border border-silver/20 bg-black/40 p-3">
              <p className="text-textWhite">{biz.name}</p>
              <p className="text-xs text-mutedText">{biz.city} · {biz.category} · {biz.slug}</p>
              <p className="text-xs text-coolSilver">
                {tx("Owner", "Owner")}: {biz.owner_email || biz.owner_name || biz.owner_id}
              </p>
              <p className="text-xs text-coolSilver">
                {tx("Plan", "Plan")}: {biz.plan} {biz.interval ? `(${biz.interval})` : ""} {biz.subscription_status ? `· ${biz.subscription_status}` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => {
                  setTransferBusinessId(biz.id);
                }}>
                  {tx("Usar ID", "Use ID")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => updateBusiness(biz.id, { isActive: !biz.is_active })}>
                  {biz.is_active ? tx("Desactivar", "Deactivate") : tx("Activar", "Activate")}
                </Button>
                <select
                  className="h-9 rounded-xl border border-silver/20 bg-richBlack/80 px-2 text-xs text-textWhite"
                  value={biz.plan}
                  onChange={(e) => updateBusiness(biz.id, { plan: e.target.value, interval: biz.interval })}
                >
                  <option value="free">Free</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="black">Black</option>
                </select>
                <select
                  className="h-9 rounded-xl border border-silver/20 bg-richBlack/80 px-2 text-xs text-textWhite"
                  value={biz.interval || ""}
                  onChange={(e) => updateBusiness(biz.id, { plan: biz.plan, interval: e.target.value || null })}
                >
                  <option value="">{tx("Sin intervalo", "No interval")}</option>
                  <option value="monthly">{tx("Mensual", "Monthly")}</option>
                  <option value="annual">{tx("Anual", "Annual")}</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Audit log", "Audit log")}</h2>
        <div className="mt-3 space-y-2 text-sm text-coolSilver">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-silver/20 bg-black/40 p-3">
              <p className="text-textWhite">{log.action}</p>
              <p className="text-xs text-mutedText">{log.target_type} · {log.target_id || "-"}</p>
              <p className="text-xs text-coolSilver">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

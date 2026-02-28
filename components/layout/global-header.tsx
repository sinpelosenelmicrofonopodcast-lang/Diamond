"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/providers/locale-provider";
import { getClientSupabase } from "@/lib/supabase/client";

type ProfileRole = "client" | "owner" | "staff" | "admin";

export function GlobalHeader() {
  const supabase = useMemo(() => getClientSupabase(), []);
  const { locale, setLocale, t, tx } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [appointmentsBadge, setAppointmentsBadge] = useState<number>(0);
  const isBusinessUser = role === "owner" || role === "staff" || role === "admin";

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data.user ?? null);

        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, avatar_url")
            .eq("id", data.user.id)
            .maybeSingle();

          if (mounted) {
            setRole((profile?.role as ProfileRole | undefined) ?? null);
            setAvatarUrl(profile?.avatar_url ?? null);
          }
        } else {
          setRole(null);
          setAvatarUrl(null);
        }
      } catch {
        if (!mounted) return;
        setUser(null);
        setRole(null);
        setAvatarUrl(null);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    async function loadAlerts() {
      try {
        if (!user || !isBusinessUser) {
          if (active) setAppointmentsBadge(0);
          return;
        }

        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const res = await fetch("/api/dashboard/alerts", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;
        const payload = await res.json().catch(() => ({ alerts: [] }));
        const unread = (payload.alerts || []).filter((alert: any) => !alert.read_at);
        if (active) setAppointmentsBadge(unread.length);
      } catch {
        if (active) setAppointmentsBadge(0);
      }
    }

    loadAlerts();
    return () => {
      active = false;
    };
  }, [supabase, user, role, isBusinessUser]);

  async function handleLogout() {
    setLoadingLogout(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const panelHref = isBusinessUser ? "/dashboard/overview" : "/client/appointments";

  const displayName = user?.user_metadata?.full_name || user?.email || t("nav.profile");
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-gold/20 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link className="flex items-center gap-2" href="/">
            {logoError ? (
              <span className="font-display text-2xl text-softGold">Diamond Studio</span>
            ) : (
              <img
                src="/diamond-studio-logo.svg?v=2"
                alt="Diamond Studio by Nicole"
                className="h-10 w-auto rounded-lg object-contain"
                loading="eager"
                onError={() => setLogoError(true)}
              />
            )}
          </Link>
          <Link className="hidden rounded-lg px-3 py-2 text-sm text-coolSilver hover:bg-gold/10 hover:text-softGold sm:inline-flex" href="/">
            {t("nav.home")}
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "es" ? "en" : "es")}
            className="rounded-lg border border-silver/20 px-2 py-1 text-xs text-coolSilver hover:border-softGold hover:text-softGold"
          >
            {locale === "es" ? t("common.english") : t("common.spanish")}
          </button>
          {user ? (
            <>
              {isBusinessUser ? (
                <Link
                  href="/dashboard/appointments"
                  className="relative inline-flex items-center gap-2 rounded-lg border border-gold/20 px-3 py-2 text-xs text-softGold hover:bg-gold/10"
                >
                  {tx("Citas", "Appointments")}
                  {appointmentsBadge > 0 ? (
                    <span className="rounded-full bg-softGold px-2 py-0.5 text-[10px] font-semibold text-black">
                      {appointmentsBadge > 9 ? "9+" : appointmentsBadge}
                    </span>
                  ) : null}
                </Link>
              ) : null}
              <Link
                href="/profile"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gold/30 bg-black/50 text-xs font-semibold text-softGold"
                aria-label={t("nav.profile")}
                title={t("nav.profile")}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={tx("Avatar", "Avatar")} className="h-9 w-9 rounded-xl object-cover" />
                ) : (
                  initials
                )}
              </Link>
              <span className="hidden max-w-[160px] truncate text-sm text-mutedText md:inline">{displayName}</span>
              <Button asChild size="sm" variant="secondary">
                <Link href={panelHref}>{t("nav.panel")}</Link>
              </Button>
              <Button onClick={handleLogout} size="sm" disabled={loadingLogout}>
                {loadingLogout ? `${t("common.loading")}` : t("nav.logout")}
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="secondary">
                <Link href="/auth/signin">{t("nav.login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/signup">{t("nav.signup")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

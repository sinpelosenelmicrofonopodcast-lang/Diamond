"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientSupabase } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const supabase = useMemo(() => getClientSupabase(), []);
  const { t, tx } = useLocale();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignup) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              account_type: "client",
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
              phone
            },
            emailRedirectTo: `${window.location.origin}/auth/signin`
          }
        });

        if (error) {
          setMessage(error.message);
        } else if (!data.session) {
          setMessage(tx("Cuenta creada. Revisa tu email para confirmar y luego inicia sesión.", "Account created. Check your email to confirm, then sign in."));
        } else {
          const res = await fetch("/api/auth/onboard-client", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`
            },
            body: JSON.stringify({
              firstName,
              lastName,
              phone
            })
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            setMessage(payload.error || tx("Cuenta creada, pero falló el onboarding del perfil.", "Account created, but profile onboarding failed."));
          } else {
            window.location.href = "/client/appointments";
          }
        }
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          setMessage(error.message);
        } else {
          let target = "/client/appointments";

          const profileRole = await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .maybeSingle();

          const role = profileRole.data?.role;
          if (role === "owner" || role === "staff" || role === "admin") {
            target = "/dashboard/overview";
          }

          window.location.href = target;
        }
      }
    } catch {
      setMessage(tx("No se pudo conectar con Supabase. Verifica internet, URL y API key.", "Could not connect to Supabase. Check your internet, URL, and API key."));
    }

    setLoading(false);
  }

  return (
    <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
      {isSignup ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={tx("Nombre", "First name")}
              aria-label={t("auth.firstName")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              placeholder={tx("Apellido", "Last name")}
              aria-label={t("auth.lastName")}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Input
            placeholder={tx("Teléfono", "Phone")}
            aria-label={t("auth.phone")}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </>
      ) : null}
      <Input
        placeholder={tx("Email", "Email")}
        type="email"
        aria-label={t("auth.email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        placeholder={tx("Contraseña", "Password")}
        type="password"
        aria-label={t("auth.password")}
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button className="w-full" disabled={loading}>
        {loading ? "..." : isSignup ? t("nav.signup") : t("nav.login")}
      </Button>

      {message ? <p className="text-sm text-coolSilver">{message}</p> : null}

      <p className="text-sm text-mutedText">
        {isSignup ? tx("¿Ya tienes cuenta?", "Already have an account?") : tx("¿No tienes cuenta?", "No account yet?")}{" "}
        <Link className="text-softGold hover:underline" href={isSignup ? "/auth/signin" : "/auth/signup"}>
          {isSignup ? tx("Inicia sesión", "Sign in") : tx("Crear cuenta", "Create account")}
        </Link>
      </p>
      {!isSignup ? (
        <p className="text-sm text-mutedText">
          {t("auth.forgot")}{" "}
          <Link className="text-softGold hover:underline" href="/auth/forgot-password">
            {t("auth.reset")}
          </Link>
        </p>
      ) : null}
    </form>
  );
}

"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getClientSupabase } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { tx } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    phone: "",
    role: "client",
    avatarUrl: ""
  });

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      setUserId(auth.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, role, avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();

      const profileData = profile as {
        full_name?: string;
        phone?: string;
        role?: string;
        avatar_url?: string;
      } | null;

      setForm({
        email: auth.user.email || "",
        fullName: profileData?.full_name || auth.user.user_metadata?.full_name || "",
        phone: profileData?.phone || auth.user.user_metadata?.phone || "",
        role: profileData?.role || "client",
        avatarUrl: profileData?.avatar_url || ""
      });
      setLoading(false);
    }

    load();
  }, [supabase]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: form.email,
        full_name: form.fullName,
        phone: form.phone,
        role: form.role,
        avatar_url: form.avatarUrl || null
      } as any,
      { onConflict: "id" }
    );

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    setSaving(false);
    setMessage(tx("Perfil actualizado.", "Profile updated."));
  }

  async function onUploadAvatar(file: File) {
    try {
      if (!userId) return;

      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("user-avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true
      });

      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("user-avatars").getPublicUrl(path);
      setForm((prev) => ({ ...prev, avatarUrl: data.publicUrl }));

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", userId);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(tx("Foto de perfil actualizada.", "Profile photo updated."));
    } catch {
      setMessage(tx("La subida fue abortada. Intenta con una imagen más ligera (JPG/PNG).", "Upload failed or was aborted. Try a lighter image (JPG/PNG)."));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <h1 className="font-display text-4xl">{tx("Mi perfil", "My profile")}</h1>
        {loading ? (
          <p className="mt-4 text-coolSilver">{tx("Cargando perfil...", "Loading profile...")}</p>
        ) : userId ? (
          <form className="mt-4 space-y-3" onSubmit={onSave}>
            {!form.avatarUrl ? (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {tx("Foto de perfil requerida para usar LuxApp (seguridad de clientes y proveedores).", "Profile photo required to use LuxApp (client/provider security).")}
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              {form.avatarUrl ? (
                <Image src={form.avatarUrl} alt="Avatar" width={68} height={68} className="h-[68px] w-[68px] rounded-2xl object-cover" />
              ) : (
                <div className="flex h-[68px] w-[68px] items-center justify-center rounded-2xl bg-gold/20 font-semibold text-softGold">
                  {(form.fullName || "U")
                    .split(" ")
                    .map((chunk) => chunk[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              )}
              <div className="flex-1">
                <Input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  onUploadAvatar(file);
                }} />
              </div>
            </div>

            <Input value={form.email} disabled />
            <Input placeholder={tx("Nombre completo", "Full name")} value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} required />
            <Input placeholder={tx("Teléfono", "Phone")} value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} required />

            <Button type="submit" disabled={saving || !form.avatarUrl}>{saving ? tx("Guardando...", "Saving...") : tx("Guardar perfil", "Save profile")}</Button>
          </form>
        ) : (
          <p className="mt-4 text-coolSilver">{tx("Inicia sesión para ver tu perfil.", "Sign in to view your profile.")}</p>
        )}

        {message ? <p className="mt-3 text-sm text-coolSilver">{message}</p> : null}
      </Card>
    </main>
  );
}

"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/providers/locale-provider";
import { getClientSupabase } from "@/lib/supabase/client";

type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  city: string;
  category: string;
  description: string | null;
  timezone: string;
  logo_url: string | null;
  cover_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function BusinessSettingsPage() {
  const { tx } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [specials, setSpecials] = useState<Array<any>>([]);
  const [specialTitle, setSpecialTitle] = useState("");
  const [specialDescription, setSpecialDescription] = useState("");
  const [specialDiscount, setSpecialDiscount] = useState("");
  const [specialStarts, setSpecialStarts] = useState("");
  const [specialEnds, setSpecialEnds] = useState("");

  useEffect(() => {
    async function loadBusiness() {
      setLoading(true);
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setMessage(tx("Inicia sesión para editar tu negocio.", "Sign in to edit your business."));
        setLoading(false);
        return;
      }

      const res = await fetch("/api/dashboard/me-business", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || tx("No se pudo cargar negocio.", "Could not load business."));
        setLoading(false);
        return;
      }

      const data = payload.business as Business | undefined;
      if (data) {
        setBusiness(data);
        setName(data.name);
        setSlug(data.slug);
        setCity(data.city);
        setCategory(data.category);
        setTimezone(data.timezone || "America/New_York");
        setDescription(data.description || "");
        setLogoUrl(data.logo_url || "");
        setCoverUrl(data.cover_url || "");
        setInstagramUrl(data.instagram_url || "");
        setFacebookUrl(data.facebook_url || "");
        setTiktokUrl(data.tiktok_url || "");
      }

      const specialsRes = await fetch("/api/dashboard/specials", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const specialsPayload = await specialsRes.json();
      if (specialsRes.ok) setSpecials(specialsPayload.specials || []);

      setLoading(false);
    }

    loadBusiness();
  }, [supabase]);

  async function uploadAsset(file: File, kind: "logo" | "cover") {
    if (!business) {
      setMessage(tx("Primero guarda los datos base del negocio.", "Save your basic business details first."));
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMessage(tx("No hay sesión activa para subir archivos.", "No active session to upload files."));
      return;
    }

    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    try {
      const res = await fetch("/api/dashboard/business-assets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || tx("No se pudo subir el archivo.", "Could not upload file."));
        return;
      }

      const publicUrl = payload.url as string;
      const updates = kind === "logo" ? { logo_url: publicUrl } : { cover_url: publicUrl };

      if (kind === "logo") setLogoUrl(publicUrl);
      if (kind === "cover") setCoverUrl(publicUrl);
      setBusiness((prev) => (prev ? { ...prev, ...updates } : prev));
      setMessage(tx(`${kind === "logo" ? "Logo" : "Banner"} actualizado.`, `${kind === "logo" ? "Logo" : "Banner"} updated.`));
    } catch {
      setMessage(tx("La subida se abortó o falló. Intenta con una imagen más ligera (JPG/PNG).", "Upload failed or was aborted. Try a lighter image (JPG/PNG)."));
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>, kind: "logo" | "cover") {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAsset(file, kind);
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSaving(false);
      setMessage(tx("No hay sesión activa para guardar el negocio.", "No active session to save business."));
      return;
    }

    const res = await fetch("/api/business/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        id: business?.id,
        name,
        slug,
        city,
        category,
        timezone,
        description,
        instagram_url: instagramUrl,
        facebook_url: facebookUrl,
        tiktok_url: tiktokUrl
      })
    });

    const payload = await res.json();
    if (!res.ok) {
      setSaving(false);
      setMessage(payload.error || tx("No se pudo guardar el negocio.", "Could not save business."));
      return;
    }

    setBusiness(payload.business as Business);
    setSaving(false);
    setMessage(business ? tx("Datos del negocio actualizados.", "Business details updated.") : tx("Negocio creado. Ya puedes subir logo y banner.", "Business created. You can now upload logo and banner."));
  }

  async function addSpecial(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMessage(tx("No hay sesión activa.", "No active session."));
      return;
    }
    const res = await fetch("/api/dashboard/specials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: specialTitle,
        description: specialDescription || null,
        discount_percent: specialDiscount ? Number(specialDiscount) : null,
        starts_at: specialStarts ? new Date(specialStarts).toISOString() : null,
        ends_at: specialEnds ? new Date(specialEnds).toISOString() : null,
        is_active: true
      })
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo guardar el especial.", "Could not save special."));
      return;
    }
    setSpecialTitle("");
    setSpecialDescription("");
    setSpecialDiscount("");
    setSpecialStarts("");
    setSpecialEnds("");
    const reload = await fetch("/api/dashboard/specials", { headers: { Authorization: `Bearer ${token}` } });
    const reloadPayload = await reload.json();
    if (reload.ok) setSpecials(reloadPayload.specials || []);
  }

  async function deleteSpecial(id: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/dashboard/specials?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await res.json();
    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo eliminar el especial.", "Could not delete special."));
      return;
    }
    setSpecials((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <main className="space-y-4">
      <h1 className="font-display text-4xl">{tx("Perfil del negocio", "Business profile")}</h1>
      <Card>
        {loading ? (
          <p className="text-coolSilver">{tx("Cargando datos del negocio...", "Loading business details...")}</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder={tx("Nombre del negocio", "Business name")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!business) setSlug(slugify(e.target.value));
                }}
                required
              />
              <Input
                placeholder={tx("Slug", "Slug")}
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                required
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder={tx("Ciudad", "City")} value={city} onChange={(e) => setCity(e.target.value)} required />
              <Input placeholder={tx("Categoría", "Category")} value={category} onChange={(e) => setCategory(e.target.value)} required />
              <Input placeholder={tx("Zona horaria", "Time zone")} value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
            </div>

            <textarea
              className="min-h-28 w-full rounded-2xl border border-silver/20 bg-richBlack/80 px-4 py-3 text-sm text-textWhite placeholder:text-mutedText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              placeholder={tx("Describe tu negocio, experiencia y servicios estrella", "Describe your business, experience, and signature services")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <p className="text-sm text-coolSilver">
              {tx("Redes sociales (se mostrarán a tus clientes)", "Social links (visible to clients)")}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder={tx("Instagram URL", "Instagram URL")}
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
              />
              <Input
                placeholder={tx("Facebook URL", "Facebook URL")}
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
              />
              <Input
                placeholder={tx("TikTok URL", "TikTok URL")}
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? tx("Guardando...", "Saving...") : business ? tx("Guardar cambios", "Save changes") : tx("Crear negocio", "Create business")}
            </Button>
          </form>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-2xl">{tx("Branding", "Branding")}</h2>
        <p className="text-sm text-coolSilver">{tx("Sube tu logo y banner para que tu página pública se vea premium.", "Upload your logo and banner to make your public page look premium.")}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-mutedText">{tx("Logo", "Logo")}</p>
            {logoUrl ? <img src={logoUrl} alt="Logo" className="h-24 w-24 rounded-2xl border border-silver/20 object-cover" /> : null}
            <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "logo")} disabled={!business} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-mutedText">{tx("Banner", "Banner")}</p>
            {coverUrl ? <img src={coverUrl} alt="Banner" className="h-28 w-full rounded-2xl border border-silver/20 object-cover" /> : null}
            <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "cover")} disabled={!business} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">{tx("Especiales y descuentos", "Specials & discounts")}</h2>
        <form className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_1fr]" onSubmit={addSpecial}>
          <Input placeholder={tx("Título", "Title")} value={specialTitle} onChange={(e) => setSpecialTitle(e.target.value)} required />
          <Input placeholder={tx("Descripción", "Description")} value={specialDescription} onChange={(e) => setSpecialDescription(e.target.value)} />
          <Input placeholder={tx("Descuento %", "Discount %")} type="number" min={0} max={100} value={specialDiscount} onChange={(e) => setSpecialDiscount(e.target.value)} />
          <Input type="datetime-local" value={specialStarts} onChange={(e) => setSpecialStarts(e.target.value)} />
          <Input type="datetime-local" value={specialEnds} onChange={(e) => setSpecialEnds(e.target.value)} />
          <Button type="submit">{tx("Agregar especial", "Add special")}</Button>
        </form>
        <div className="mt-3 space-y-2 text-sm text-coolSilver">
          {specials.map((deal) => (
            <div key={deal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-silver/20 bg-black/40 p-3">
              <div>
                <p className="text-textWhite">{deal.title}</p>
                {deal.description ? <p className="text-xs text-mutedText">{deal.description}</p> : null}
                {typeof deal.discount_percent === "number" ? <p className="text-xs text-softGold">{deal.discount_percent}% OFF</p> : null}
              </div>
              <Button size="sm" variant="secondary" onClick={() => deleteSpecial(deal.id)}>
                {tx("Eliminar", "Remove")}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {message ? <p className="text-sm text-coolSilver">{message}</p> : null}
    </main>
  );
}

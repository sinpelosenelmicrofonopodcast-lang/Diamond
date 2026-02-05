import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReviewSection } from "@/components/reviews/review-section";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons/social";
import { getBusinessBySlug } from "@/lib/queries";
import { getServerLocale } from "@/lib/i18n/server";

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, services, staff, policies, reviews, specials } = await getBusinessBySlug(slug);
  const locale = await getServerLocale();
  const tx = (es: string, en: string) => (locale === "en" ? en : es);
  const bookingWindowEnd = addDays(new Date(), 30);
  const publicStaff = (staff || []).filter((member: any) => Boolean(member.avatar_url));
  const socialLinks = [
    { key: "instagram", label: "Instagram", url: business?.instagram_url, icon: InstagramIcon },
    { key: "facebook", label: "Facebook", url: business?.facebook_url, icon: FacebookIcon },
    { key: "tiktok", label: "TikTok", url: business?.tiktok_url, icon: TikTokIcon }
  ].filter((item) => item.url);

  if (!business) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <section className="lux-card overflow-hidden p-0">
        <div className="relative h-56">
          {business.cover_url ? (
            <Image src={business.cover_url} alt={`Cover ${business.name}`} fill className="object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-gold/20 to-silver/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
        </div>
        <div className="space-y-3 p-6">
          <div className="flex items-center gap-3">
            {business.logo_url ? (
              <Image
                src={business.logo_url}
                alt={`Logo ${business.name}`}
                width={60}
                height={60}
                className="h-[60px] w-[60px] rounded-2xl border border-gold/40 object-cover"
              />
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-softGold">{tx("Booking Premium", "Premium booking")}</p>
              <h1 className="font-display text-4xl">{business.name}</h1>
            </div>
          </div>
          <p className="text-mutedText">{business.city} · {business.category}</p>
          <div className="flex flex-wrap gap-2">
            <Badge>⭐ {business.rating ?? tx("Nuevo", "New")}</Badge>
            <Badge className={business.available_today ? "bg-emerald-500/10 text-emerald-300" : "bg-silver/15 text-coolSilver"}>
              {business.available_today ? tx("Disponible hoy", "Available today") : tx("Disponibilidad limitada", "Limited availability")}
            </Badge>
            <Badge className="bg-gold/10 text-softGold">
              {tx("Agenda hasta", "Booking until")} {bookingWindowEnd.toLocaleDateString(locale === "en" ? "en-US" : "es-US", { month: "short", day: "numeric" })}
            </Badge>
          </div>
          <Button asChild>
            <Link href={`/b/${slug}/book`}>{tx("Reservar", "Book")}</Link>
          </Button>
        </div>
      </section>

      {socialLinks.length ? (
        <Card>
          <h2 className="font-display text-2xl">{tx("Redes sociales", "Social links")}</h2>
          <p className="mt-1 text-sm text-mutedText">{tx("Conecta con el negocio en sus redes.", "Connect with the business on social media.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {socialLinks.map((item) => (
              <a
                key={item.key}
                href={item.url as string}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-gold/30 px-3 py-2 text-softGold hover:bg-gold/10"
                aria-label={item.label}
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl">{tx("Servicios", "Services")}</h2>
          <div className="mt-4 space-y-3 text-sm text-coolSilver">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between gap-3 rounded-xl border border-silver/20 bg-black/40 p-3">
                <div className="flex items-center gap-3">
                  {service.image_url ? (
                    <Image src={service.image_url} alt={service.name} width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-silver/20 text-xs text-coolSilver">
                      {tx("Sin foto", "No photo")}
                    </div>
                  )}
                  <p>{service.name}</p>
                </div>
                <p>
                  {service.price_starts_at
                    ? `${tx("Desde", "From")} ${(service.price_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}`
                    : (service.price_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl">{tx("Políticas", "Policies")}</h2>
          <div className="mt-4 space-y-2 text-sm text-coolSilver">
            <p>{tx("Auto confirmación", "Auto confirmation")}: {policies?.auto_confirm ? tx("Sí", "Yes") : tx("No", "No")}</p>
            <p>{tx("Depósito base", "Base deposit")}: {policies?.base_deposit_percent ?? 0}%</p>
            <p>
              {tx("Cancelación mínima", "Minimum cancellation")}: {Math.round((policies?.min_cancel_minutes ?? 240) / 60)} {tx("horas", "hours")}
            </p>
            <p>
              {tx("Tolerancia tardanza", "Late tolerance")}: {policies?.late_tolerance_minutes ?? 10} {tx("min", "min")}
            </p>
          </div>
        </Card>
      </section>

      {specials && specials.length ? (
        <Card>
          <h2 className="font-display text-2xl">{tx("Especiales", "Specials")}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {specials.map((deal: any) => (
              <div key={deal.id} className="rounded-2xl border border-silver/20 bg-black/40 p-3">
                <p className="text-softGold">{deal.title}</p>
                {deal.description ? <p className="mt-1 text-sm text-coolSilver">{deal.description}</p> : null}
                {typeof deal.discount_percent === "number" ? (
                  <p className="mt-2 text-xs text-mutedText">{deal.discount_percent}% OFF</p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-display text-2xl">{tx("Profesionales", "Professionals")}</h2>
        <p className="mt-1 text-sm text-mutedText">{tx("Equipo especializado que ofrece los servicios.", "Specialized team providing the services.")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {publicStaff.map((member) => (
            <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-silver/20 bg-black/40 p-3">
              {member.avatar_url ? (
                <Image src={member.avatar_url} alt={member.display_name} width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/20 text-sm font-semibold text-softGold">
                  {member.display_name
                    .split(" ")
                    .map((chunk: string) => chunk[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              )}
              <p className="text-sm text-textWhite">{member.display_name}</p>
            </div>
          ))}
          {publicStaff.length === 0 ? <p className="text-sm text-rose-300">{tx("Este negocio aún no ha publicado staff con foto de perfil.", "This business has not published staff with profile photos yet.")}</p> : null}
        </div>
      </Card>

      <ReviewSection businessId={business.id} initialReviews={reviews || []} />
    </main>
  );
}

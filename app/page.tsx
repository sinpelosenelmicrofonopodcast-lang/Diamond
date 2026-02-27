import { DiamondSlideshow } from "@/components/marketing/diamond-slideshow";
import { getBusinessBySlug } from "@/lib/queries";
import { SINGLE_BUSINESS_SLUG, SINGLE_BUSINESS_NAME } from "@/lib/single-business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const { business, services, specials } = await getBusinessBySlug(SINGLE_BUSINESS_SLUG);

  const gallery = [
    business?.cover_url ? { src: business.cover_url, alt: `${SINGLE_BUSINESS_NAME} cover` } : null,
    business?.logo_url ? { src: business.logo_url, alt: `${SINGLE_BUSINESS_NAME} logo` } : null,
    ...(services || [])
      .filter((item: any) => Boolean(item.image_url))
      .slice(0, 6)
      .map((item: any) => ({ src: item.image_url as string, alt: item.name as string }))
  ].filter(Boolean) as Array<{ src: string; alt: string }>;

  const categorized = Object.entries(
    (services || []).reduce((acc: Record<string, any[]>, service: any) => {
      const key = service.category || "General";
      if (!acc[key]) acc[key] = [];
      acc[key].push(service);
      return acc;
    }, {})
  );

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:py-10">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="lux-card relative overflow-hidden p-6 md:p-8">
          <div className="absolute inset-0 bg-glow" />
          <div className="relative z-10 space-y-4">
            <p className="inline-flex rounded-full border border-gold/30 bg-gold/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-softGold">
              Diamond Studio
            </p>
            <h1 className="font-display text-4xl leading-tight text-textWhite md:text-6xl">{SINGLE_BUSINESS_NAME}</h1>
            <p className="max-w-2xl text-mutedText">
              {business?.description || "Premium booking experience for nails, beauty, and self-care."}
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="gold-gradient inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-black" href={`/b/${SINGLE_BUSINESS_SLUG}/book`}>
                Reservar cita
              </a>
              <a className="inline-flex h-11 items-center justify-center rounded-2xl border border-silver/30 px-5 text-sm font-semibold text-textWhite hover:border-softGold" href={`/b/${SINGLE_BUSINESS_SLUG}`}>
                Ver perfil
              </a>
            </div>
            <p className="text-sm text-coolSilver">
              {business?.city || "Killeen"} · {business?.category || "Beauty"}
            </p>
          </div>
        </div>
        <DiamondSlideshow slides={gallery} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl text-textWhite">Servicios</h2>
          <a className="rounded-xl border border-gold/30 px-3 py-2 text-xs text-softGold hover:bg-gold/10" href={`/b/${SINGLE_BUSINESS_SLUG}/book`}>
            Reservar ahora
          </a>
        </div>

        {categorized.length === 0 ? (
          <div className="lux-card p-5 text-sm text-coolSilver">No hay servicios publicados todavía.</div>
        ) : (
          <div className="space-y-4">
            {categorized.map(([category, items]) => (
              <div key={category} className="lux-card p-4">
                <p className="text-sm text-softGold">{category}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {items.map((service: any) => (
                    <div key={service.id} className="rounded-2xl border border-silver/20 bg-black/40 p-3">
                      <p className="text-textWhite">{service.name}</p>
                      <p className="text-xs text-mutedText">
                        {service.duration_min} min · {service.price_starts_at ? "From " : ""}${(service.price_cents / 100).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(specials || []).length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-3xl text-softGold">Especiales</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {(specials || []).slice(0, 4).map((deal: any) => (
              <div key={deal.id} className="lux-card p-4">
                <p className="text-softGold">{deal.title}</p>
                {deal.description ? <p className="mt-1 text-sm text-coolSilver">{deal.description}</p> : null}
                {typeof deal.discount_percent === "number" ? (
                  <p className="mt-2 text-xs text-mutedText">{deal.discount_percent}% OFF</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

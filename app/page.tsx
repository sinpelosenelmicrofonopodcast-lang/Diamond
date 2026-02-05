import { LandingHero } from "@/components/landing/hero";
import { BusinessCard } from "@/components/landing/business-card";
import { getServerT } from "@/lib/i18n/server";
import { searchBusinesses } from "@/lib/queries";
import { getAdminSupabase } from "@/lib/supabase/admin";

interface HomeProps {
  searchParams: Promise<{ city?: string; category?: string; query?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const businesses = await searchBusinesses(params);
  const { t } = await getServerT();
  const admin = getAdminSupabase();
  const { data: specials } = await admin
    .from("business_specials")
    .select("id, title, description, discount_percent, business_id, businesses(name, slug)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:py-12">
      <LandingHero />

      <section className="space-y-4">
        <h2 className="font-display text-3xl text-textWhite">{t("home.featured")}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-3xl text-softGold">{t("home.deals")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(specials || []).map((deal: any) => (
            <div key={deal.id} className="lux-card p-4">
              <p className="text-softGold">{deal.title}</p>
              {deal.description ? <p className="mt-1 text-sm text-coolSilver">{deal.description}</p> : null}
              <p className="mt-2 text-xs text-mutedText">
                {(deal as any).businesses?.name} · {deal.discount_percent ? `${deal.discount_percent}% OFF` : t("home.special")}
              </p>
              <a
                className="mt-3 inline-flex rounded-xl border border-gold/30 px-3 py-2 text-xs text-softGold hover:bg-gold/10"
                href={`/b/${(deal as any).businesses?.slug}`}
              >
                {t("home.viewBusiness")}
              </a>
            </div>
          ))}
          {(specials || []).length === 0 ? (
            <p className="text-sm text-coolSilver">{t("home.noDeals")}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

import { getServerSupabase } from "@/lib/supabase/server";
import { BusinessCard, SearchFilters } from "@/types/domain";
import { SINGLE_BUSINESS_SLUG_ALIASES } from "@/lib/single-business";

export async function searchBusinesses(filters: SearchFilters): Promise<BusinessCard[]> {
  try {
    const { business } = await getBusinessBySlug(SINGLE_BUSINESS_SLUG_ALIASES[0]);
    if (!business) return [];

    const matchCity = !filters.city || String(business.city || "").toLowerCase().includes(filters.city.toLowerCase());
    const matchCategory = !filters.category || String(business.category || "").toLowerCase() === filters.category.toLowerCase();
    const matchQuery =
      !filters.query ||
      String(business.name || "").toLowerCase().includes(filters.query.toLowerCase()) ||
      String(business.slug || "").toLowerCase().includes(filters.query.toLowerCase());

    if (!matchCity || !matchCategory || !matchQuery) return [];

    return [
      {
        id: business.id,
        slug: business.slug,
        name: business.name,
        city: business.city,
        category: business.category,
        rating: business.rating || undefined,
        coverUrl: business.cover_url || undefined,
        logoUrl: business.logo_url || undefined,
        availableToday: business.available_today
      }
    ];
  } catch {
    return [];
  }
}

async function resolveDiamondBusiness(supabase: ReturnType<typeof getServerSupabase>, slug: string) {
  const { data: directBusiness } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle();
  if (directBusiness) return directBusiness;

  const isDiamondRoute = SINGLE_BUSINESS_SLUG_ALIASES.includes(slug as (typeof SINGLE_BUSINESS_SLUG_ALIASES)[number]);
  if (!isDiamondRoute) return null;

  const { data: candidates } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);

  if (!candidates || candidates.length === 0) return null;

  const ids = candidates.map((item: any) => item.id);
  const [{ data: serviceRows }, { data: appointmentRows }] = await Promise.all([
    ids.length ? supabase.from("services").select("business_id").in("business_id", ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? supabase.from("appointments").select("business_id").in("business_id", ids) : Promise.resolve({ data: [] as any[] })
  ]);

  const serviceCount = new Map<string, number>();
  for (const row of serviceRows || []) {
    serviceCount.set(row.business_id, (serviceCount.get(row.business_id) || 0) + 1);
  }

  const appointmentCount = new Map<string, number>();
  for (const row of appointmentRows || []) {
    appointmentCount.set(row.business_id, (appointmentCount.get(row.business_id) || 0) + 1);
  }

  const normalized = (value: unknown) => String(value || "").toLowerCase();
  const scored = candidates
    .map((item: any) => {
      const slugValue = normalized(item.slug);
      const nameValue = normalized(item.name);
      let score = 0;
      if (SINGLE_BUSINESS_SLUG_ALIASES.includes(item.slug)) score += 300;
      if (nameValue.includes("diamond")) score += 120;
      if (nameValue.includes("nicole")) score += 80;
      if (slugValue.includes("diamond")) score += 60;
      if (item.is_active) score += 20;
      score += (serviceCount.get(item.id) || 0) * 6;
      score += (appointmentCount.get(item.id) || 0) * 2;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.item || null;
}

export async function getBusinessBySlug(slug: string) {
  try {
    const supabase = getServerSupabase();
    const business = await resolveDiamondBusiness(supabase, slug);

    if (!business) {
      return { business: null, services: [], staff: [], policies: null };
    }

    const [{ data: servicesRaw }, { data: staff }, { data: policies }, { data: paymentMethods }, { data: ownerProfile }, { data: reviews }, { data: specials }] = await Promise.all([
      supabase
        .from("services")
        .select("id, name, category, description, duration_min, buffer_before_min, buffer_after_min, price_cents, price_starts_at, image_url, requires_confirmation, requires_payment, is_active, sort_order")
        .eq("business_id", business.id)
        .order("sort_order", { ascending: true }),
      supabase.from("staff_profiles").select("*").eq("business_id", business.id).eq("is_active", true),
      supabase.from("business_policies").select("*").eq("business_id", business.id).single(),
      supabase
        .from("business_payment_methods")
        .select("method, account_label, account_value, payment_url, notes")
        .eq("business_id", business.id)
        .eq("is_enabled", true),
      supabase.from("profiles").select("id, full_name, avatar_url").eq("id", business.owner_id).maybeSingle(),
      supabase
        .from("business_reviews")
        .select("id, rating, comment, reply, created_at")
        .eq("business_id", business.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("business_specials")
        .select("id, title, description, discount_percent, starts_at, ends_at")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
    ]);

    const normalizedStaff =
      staff && staff.length > 0
        ? staff
        : ownerProfile
          ? [
              {
                id: ownerProfile.id,
                display_name: ownerProfile.full_name || "Owner",
                avatar_url: ownerProfile.avatar_url,
                bio: "Atención directa del negocio",
                is_active: true
              }
            ]
          : [
              {
                id: `fallback-${business.id}`,
                display_name: "Equipo principal",
                avatar_url: business.logo_url || null,
                bio: "Atención directa del negocio",
                is_active: true
              }
            ];

    const allServices = servicesRaw || [];
    const activeServices = allServices.filter((item: any) => item.is_active !== false);
    const services = activeServices.length > 0 ? activeServices : allServices;

    return { business, services, staff: normalizedStaff, policies, paymentMethods: paymentMethods || [], reviews: reviews || [], specials: specials || [] };
  } catch {
    return { business: null, services: [], staff: [], policies: null, paymentMethods: [], reviews: [], specials: [] };
  }
}

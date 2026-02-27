import { getServerSupabase } from "@/lib/supabase/server";
import { BusinessCard, SearchFilters } from "@/types/domain";
import { SINGLE_BUSINESS_SLUG_ALIASES } from "@/lib/single-business";

export async function searchBusinesses(filters: SearchFilters): Promise<BusinessCard[]> {
  try {
    const supabase = getServerSupabase();

    let query = supabase
      .from("businesses")
      .select("id, slug, name, city, category, rating, cover_url, logo_url, available_today")
      .in("slug", [...SINGLE_BUSINESS_SLUG_ALIASES])
      .order("priority_rank", { ascending: true });

    if (filters.city) query = query.ilike("city", `%${filters.city}%`);
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.query) query = query.or(`name.ilike.%${filters.query}%,slug.ilike.%${filters.query}%`);

    const { data, error } = await query.limit(24);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      category: row.category,
      rating: row.rating || undefined,
      coverUrl: row.cover_url || undefined,
      logoUrl: row.logo_url || undefined,
      availableToday: row.available_today
    }));
  } catch {
    return [];
  }
}

export async function getBusinessBySlug(slug: string) {
  try {
    const supabase = getServerSupabase();
    const { data: directBusiness } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle();
    const business =
      directBusiness ||
      (SINGLE_BUSINESS_SLUG_ALIASES.includes(slug as (typeof SINGLE_BUSINESS_SLUG_ALIASES)[number])
        ? (
            await supabase
              .from("businesses")
              .select("*")
              .in("slug", [...SINGLE_BUSINESS_SLUG_ALIASES])
              .eq("is_active", true)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle()
          ).data
        : null);

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

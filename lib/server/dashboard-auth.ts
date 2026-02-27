import { createClient } from "@supabase/supabase-js";

import { SINGLE_BUSINESS_SLUG_ALIASES } from "@/lib/single-business";
import { getAdminSupabase } from "@/lib/supabase/admin";

async function pickBestBusinessForUser(admin: ReturnType<typeof getAdminSupabase>, candidates: Array<{ id: string; slug?: string | null; created_at?: string }>) {
  if (candidates.length <= 1) return candidates[0] || null;

  const preferred = candidates.find((row) =>
    SINGLE_BUSINESS_SLUG_ALIASES.includes(String(row.slug || "") as (typeof SINGLE_BUSINESS_SLUG_ALIASES)[number])
  );
  if (preferred) return preferred;

  const ids = candidates.map((item) => item.id);
  const { data: serviceRows } = await admin.from("services").select("business_id").in("business_id", ids);
  const serviceCount = new Map<string, number>();
  for (const row of serviceRows || []) {
    serviceCount.set((row as any).business_id, (serviceCount.get((row as any).business_id) || 0) + 1);
  }

  const ranked = [...candidates].sort((a, b) => (serviceCount.get(b.id) || 0) - (serviceCount.get(a.id) || 0));
  return ranked[0] || null;
}

export interface DashboardContext {
  userId: string;
  email: string | null;
  businessId: string;
  isOwner: boolean;
}

export async function getDashboardContext(req: Request): Promise<{ ctx?: DashboardContext; error?: string; status?: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local", status: 500 };
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { error: "Missing auth token", status: 401 };
  }

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: authData, error: authError } = await anon.auth.getUser(token);

  if (authError || !authData.user) {
    return { error: "Token inválido", status: 401 };
  }

  const user = authData.user;
  const admin = getAdminSupabase();

  const { data: ownedBusinesses } = await admin
    .from("businesses")
    .select("id, slug, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(50);

  const preferredOwned = await pickBestBusinessForUser(admin, (ownedBusinesses || []) as any[]);

  if (preferredOwned?.id) {
    return {
      ctx: {
        userId: user.id,
        email: user.email ?? null,
        businessId: preferredOwned.id,
        isOwner: true
      }
    };
  }

  const { data: memberships } = await admin
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(50);

  const membershipBusinessIds = (memberships || []).map((row: any) => row.business_id).filter(Boolean);
  if (membershipBusinessIds.length === 0) {
    return { error: "No tienes negocio asignado", status: 403 };
  }

  const { data: memberBusinesses } = await admin
    .from("businesses")
    .select("id, slug, created_at")
    .in("id", membershipBusinessIds)
    .order("created_at", { ascending: true });

  const preferredMemberBusiness = await pickBestBusinessForUser(admin, (memberBusinesses || []) as any[]);

  if (!preferredMemberBusiness?.id) {
    return { error: "No tienes negocio asignado", status: 403 };
  }

  return {
    ctx: {
      userId: user.id,
      email: user.email ?? null,
      businessId: preferredMemberBusiness.id,
      isOwner: false
    }
  };
}

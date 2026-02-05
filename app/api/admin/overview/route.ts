import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";

export async function GET(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const admin = getAdminSupabase();
  const { data: businesses, error: bizError } = await admin
    .from("businesses")
    .select("id, name, slug, city, category, owner_id, created_at, is_active")
    .order("created_at", { ascending: false });

  if (bizError) return NextResponse.json({ error: bizError.message }, { status: 400 });

  const ownerIds = Array.from(new Set((businesses || []).map((b) => b.owner_id).filter(Boolean)));
  const { data: owners } = ownerIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", ownerIds)
    : { data: [] as any[] };

  const ownerMap = new Map((owners || []).map((o: any) => [o.id, o]));
  const { data: subs } = await admin
    .from("business_subscriptions")
    .select("business_id, plan, interval, status");
  const subsMap = new Map((subs || []).map((s: any) => [s.business_id, s]));

  const result = (businesses || []).map((b: any) => ({
    ...b,
    owner_email: ownerMap.get(b.owner_id)?.email || null,
    owner_name: ownerMap.get(b.owner_id)?.full_name || null,
    plan: subsMap.get(b.id)?.plan || "free",
    interval: subsMap.get(b.id)?.interval || null,
    subscription_status: subsMap.get(b.id)?.status || null
  }));

  return NextResponse.json({ businesses: result });
}

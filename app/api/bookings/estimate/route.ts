import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getRequiredDepositPercent } from "@/lib/booking/risk";
import { getAdminSupabase } from "@/lib/supabase/admin";

const schema = z.object({
  businessId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  guestCount: z.number().int().min(0).max(1).default(0),
  businessDepositPercent: z.number().min(0).max(100),
  clientEmail: z.string().email().optional()
});

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: authData, error: authError } = await anon.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  const user = authData.user;
  const admin = getAdminSupabase();

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const safeEmail = profile?.email || user.email || parsed.data.clientEmail || "";

  const { data: stats } = await admin
    .from("customer_global_stats")
    .select("risk_score")
    .eq("email", safeEmail)
    .maybeSingle();

  const globalRiskScore = stats?.risk_score ?? 0;
  const requiredDepositPercent = getRequiredDepositPercent({
    businessDepositPercent: parsed.data.businessDepositPercent,
    globalRiskScore,
    hasGlobalSoftBlacklist: false
  });

  const { data: services, error: serviceError } = await admin
    .from("services")
    .select("id, price_cents, duration_min")
    .eq("business_id", parsed.data.businessId)
    .in("id", parsed.data.serviceIds);

  if (serviceError) return NextResponse.json({ error: serviceError.message }, { status: 400 });
  if (!services || services.length !== parsed.data.serviceIds.length) {
    return NextResponse.json({ error: "Servicios inválidos." }, { status: 400 });
  }

  const basePrice = services.reduce((acc, item) => acc + (item.price_cents || 0), 0);
  const totalPriceCents = basePrice * (parsed.data.guestCount === 1 ? 2 : 1);
  const requiredDepositCents = Math.round(totalPriceCents * (requiredDepositPercent / 100));

  return NextResponse.json({
    requiredDepositPercent,
    requiredDepositCents,
    totalPriceCents
  });
}

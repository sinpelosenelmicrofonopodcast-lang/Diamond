import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/server/dashboard-auth";

const schema = z.object({
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  reason: z.string().optional()
});

export async function GET(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const admin = getAdminSupabase();
  const { data, error: fetchError } = await admin
    .from("business_time_blocks")
    .select("id, starts_at, ends_at, reason, created_at")
    .eq("business_id", ctx.businessId)
    .order("starts_at", { ascending: true });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
  return NextResponse.json({ blocks: data || [] });
}

export async function POST(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { error: insertError } = await admin.from("business_time_blocks").insert({
    business_id: ctx.businessId,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at,
    reason: parsed.data.reason || null
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const admin = getAdminSupabase();
  const { error: delError } = await admin
    .from("business_time_blocks")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

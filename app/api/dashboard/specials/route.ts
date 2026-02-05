import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/server/dashboard-auth";

const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  discount_percent: z.number().int().min(0).max(100).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  is_active: z.boolean().optional()
});

export async function GET(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const admin = getAdminSupabase();
  const { data, error: fetchError } = await admin
    .from("business_specials")
    .select("id, title, description, discount_percent, starts_at, ends_at, is_active, created_at")
    .eq("business_id", ctx.businessId)
    .order("created_at", { ascending: false });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
  return NextResponse.json({ specials: data || [] });
}

export async function POST(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { error: upsertError } = await admin
    .from("business_specials")
    .upsert(
      {
        id: parsed.data.id,
        business_id: ctx.businessId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        discount_percent: typeof parsed.data.discount_percent === "number" ? parsed.data.discount_percent : null,
        starts_at: parsed.data.starts_at || null,
        ends_at: parsed.data.ends_at || null,
        is_active: parsed.data.is_active ?? true
      },
      { onConflict: "id" }
    );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const admin = getAdminSupabase();
  const { error: delError } = await admin
    .from("business_specials")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.businessId);

  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

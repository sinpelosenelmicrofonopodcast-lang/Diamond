import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/admin-audit";

const schema = z.object({
  email: z.string().email(),
  reason: z.string().optional(),
  active: z.boolean()
});

export async function POST(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();

  await admin
    .from("soft_blacklist")
    .update({ active: false })
    .eq("scope", "global")
    .eq("customer_email", parsed.data.email)
    .eq("active", true);

  if (parsed.data.active) {
    const { error: insertError } = await admin.from("soft_blacklist").insert({
      scope: "global",
      customer_email: parsed.data.email,
      reason: parsed.data.reason || null,
      active: true,
      created_by: ctx.userId
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  await logAdminAction({
    adminId: ctx.userId,
    action: parsed.data.active ? "global_blacklist_add" : "global_blacklist_remove",
    targetType: "customer",
    details: { email: parsed.data.email, reason: parsed.data.reason || null }
  });

  return NextResponse.json({ ok: true });
}

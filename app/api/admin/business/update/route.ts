import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/admin-audit";

const schema = z.object({
  businessId: z.string().uuid(),
  isActive: z.boolean().optional(),
  plan: z.enum(["free", "silver", "gold", "black"]).optional(),
  interval: z.enum(["monthly", "annual"]).nullable().optional()
});

export async function POST(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();

  if (typeof parsed.data.isActive === "boolean") {
    const { error: bizError } = await admin
      .from("businesses")
      .update({ is_active: parsed.data.isActive })
      .eq("id", parsed.data.businessId);
    if (bizError) return NextResponse.json({ error: bizError.message }, { status: 400 });
    await logAdminAction({
      adminId: ctx.userId,
      action: parsed.data.isActive ? "activate_business" : "deactivate_business",
      targetType: "business",
      targetId: parsed.data.businessId
    });
  }

  if (parsed.data.plan) {
    const { error: subError } = await admin
      .from("business_subscriptions")
      .upsert(
        {
          business_id: parsed.data.businessId,
          plan: parsed.data.plan,
          interval: parsed.data.interval || null,
          status: "active"
        },
        { onConflict: "business_id" }
      );
    if (subError) return NextResponse.json({ error: subError.message }, { status: 400 });
    await logAdminAction({
      adminId: ctx.userId,
      action: "change_plan",
      targetType: "business",
      targetId: parsed.data.businessId,
      details: { plan: parsed.data.plan, interval: parsed.data.interval || null }
    });
  }

  return NextResponse.json({ ok: true });
}

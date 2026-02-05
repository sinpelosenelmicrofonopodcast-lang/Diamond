import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/admin-audit";

const schema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(500)
});

export async function POST(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: businesses } = await admin.from("businesses").select("id, owner_id");

  const notifications = (businesses || []).map((biz: any) => ({
    user_id: biz.owner_id,
    business_id: biz.id,
    kind: "admin_broadcast",
    channel: "in_app",
    payload: {
      title: parsed.data.title,
      body: parsed.data.body
    }
  }));

  if (notifications.length) {
    await admin.from("notifications").insert(notifications);
  }

  await logAdminAction({
    adminId: ctx.userId,
    action: "broadcast",
    targetType: "system",
    details: { title: parsed.data.title }
  });

  return NextResponse.json({ ok: true, count: notifications.length });
}

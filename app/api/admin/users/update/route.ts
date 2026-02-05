import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/admin-audit";

const schema = z.object({
  email: z.string().email(),
  suspend: z.boolean().optional(),
  verifyEmail: z.boolean().optional()
});

export async function POST(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (!profile?.id) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  if (typeof parsed.data.suspend === "boolean") {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ is_suspended: parsed.data.suspend })
      .eq("id", profile.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    await logAdminAction({
      adminId: ctx.userId,
      action: parsed.data.suspend ? "suspend_user" : "unsuspend_user",
      targetType: "user",
      targetId: profile.id,
      details: { email: parsed.data.email }
    });
  }

  if (parsed.data.verifyEmail) {
    const { error: verifyError } = await admin.auth.admin.updateUserById(profile.id, {
      email_confirm: true
    });
    if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 400 });
    await logAdminAction({
      adminId: ctx.userId,
      action: "verify_email",
      targetType: "user",
      targetId: profile.id,
      details: { email: parsed.data.email }
    });
  }

  return NextResponse.json({ ok: true });
}

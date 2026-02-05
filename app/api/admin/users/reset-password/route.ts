import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/admin-audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
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

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
    password: parsed.data.password
  });

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await logAdminAction({
    adminId: ctx.userId,
    action: "reset_password",
    targetType: "user",
    targetId: profile.id,
    details: { email: parsed.data.email }
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/admin-audit";

const schema = z.object({
  businessId: z.string().uuid(),
  newOwnerEmail: z.string().email()
});

export async function POST(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: newOwner } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", parsed.data.newOwnerEmail)
    .maybeSingle();

  if (!newOwner?.id) return NextResponse.json({ error: "Nuevo dueño no existe." }, { status: 404 });

  const { error: updateError } = await admin
    .from("businesses")
    .update({ owner_id: newOwner.id })
    .eq("id", parsed.data.businessId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await admin.from("business_memberships").upsert(
    {
      business_id: parsed.data.businessId,
      user_id: newOwner.id,
      role: "owner",
      is_active: true
    },
    { onConflict: "business_id,user_id" }
  );

  await admin.from("profiles").update({ role: "owner" }).eq("id", newOwner.id);

  await logAdminAction({
    adminId: ctx.userId,
    action: "transfer_business",
    targetType: "business",
    targetId: parsed.data.businessId,
    details: { new_owner_email: parsed.data.newOwnerEmail }
  });

  return NextResponse.json({ ok: true, businessId: parsed.data.businessId, newOwnerId: newOwner.id });
}

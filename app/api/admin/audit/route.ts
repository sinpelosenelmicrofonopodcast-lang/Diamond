import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";

export async function GET(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const admin = getAdminSupabase();
  const { data, error: logError } = await admin
    .from("admin_audit_logs")
    .select("id, admin_id, action, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (logError) return NextResponse.json({ error: logError.message }, { status: 400 });
  return NextResponse.json({ logs: data || [] });
}

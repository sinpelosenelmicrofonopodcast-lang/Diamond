import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/server/admin-auth";

export async function GET(req: Request) {
  const { ctx, error, status } = await getAdminContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const admin = getAdminSupabase();
  const { data: businesses, error: bizError } = await admin
    .from("businesses")
    .select("id, name, slug, city, category, owner_id, is_active, created_at");

  if (bizError) return NextResponse.json({ error: bizError.message }, { status: 400 });

  const headers = ["id", "name", "slug", "city", "category", "owner_id", "is_active", "created_at"];
  const rows = (businesses || []).map((b: any) => [
    b.id,
    b.name,
    b.slug,
    b.city,
    b.category,
    b.owner_id,
    b.is_active ? "true" : "false",
    b.created_at
  ]);

  const escape = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=luxapp_businesses.csv"
    }
  });
}

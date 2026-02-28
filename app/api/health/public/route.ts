import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { SINGLE_BUSINESS_SLUG } from "@/lib/single-business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
        env: {
          NEXT_PUBLIC_SUPABASE_URL: Boolean(supabaseUrl),
          NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(supabaseAnonKey),
          SUPABASE_SERVICE_ROLE_KEY: hasServiceRole
        }
      },
      { status: 500 }
    );
  }

  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const [{ data: canonical, error: canonicalError }, { data: businesses, error: businessesError }] = await Promise.all([
    anon.from("businesses").select("id, slug, name, is_active").eq("slug", SINGLE_BUSINESS_SLUG).maybeSingle(),
    anon.from("businesses").select("id, slug, name, is_active").limit(10)
  ]);

  return NextResponse.json({
    ok: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: true,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
      SUPABASE_SERVICE_ROLE_KEY: hasServiceRole
    },
    canonical: canonical || null,
    canonicalError: canonicalError?.message || null,
    businessesCount: businesses?.length || 0,
    businessesError: businessesError?.message || null,
    sampleSlugs: (businesses || []).map((b) => b.slug)
  });
}


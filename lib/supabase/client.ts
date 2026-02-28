"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;
let warnedMissingEnv = false;

export function getClientSupabase() {
  if (browserClient) return browserClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  if ((!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && !warnedMissingEnv) {
    warnedMissingEnv = true;
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Environment Variables.");
  }

  browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

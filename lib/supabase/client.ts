"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

export function getClientSupabase() {
  if (browserClient) return browserClient;
  browserClient = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return browserClient;
}

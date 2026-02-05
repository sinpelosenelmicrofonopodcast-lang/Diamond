import { createClient } from "@supabase/supabase-js";

import { getAdminSupabase } from "@/lib/supabase/admin";

export interface AdminContext {
  userId: string;
  email: string | null;
}

export async function getAdminContext(req: Request): Promise<{ ctx?: AdminContext; error?: string; status?: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local", status: 500 };
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Missing auth token", status: 401 };

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: authData, error: authError } = await anon.auth.getUser(token);
  if (authError || !authData.user) return { error: "Token inválido", status: 401 };

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, email, is_suspended")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profile?.is_suspended) return { error: "Cuenta suspendida", status: 403 };
  if (profile?.role !== "admin") return { error: "No autorizado", status: 403 };

  return {
    ctx: {
      userId: authData.user.id,
      email: profile?.email || authData.user.email || null
    }
  };
}

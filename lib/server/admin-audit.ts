import { getAdminSupabase } from "@/lib/supabase/admin";

export async function logAdminAction(input: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = getAdminSupabase();
  await admin.from("admin_audit_logs").insert({
    admin_id: input.adminId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId || null,
    details: input.details || {}
  });
}

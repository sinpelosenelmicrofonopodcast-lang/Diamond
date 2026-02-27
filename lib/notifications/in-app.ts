import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/notifications/push";

type BusinessNotificationInput = {
  businessId: string;
  appointmentId?: string | null;
  userId?: string | null;
  kind: string;
  payload?: Record<string, unknown>;
};

type UserNotificationInput = {
  userId: string;
  businessId?: string | null;
  appointmentId?: string | null;
  kind: string;
  payload?: Record<string, unknown>;
};

export async function createBusinessNotification(input: BusinessNotificationInput) {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notifications").insert({
    user_id: input.userId || null,
    business_id: input.businessId,
    appointment_id: input.appointmentId || null,
    kind: input.kind,
    channel: "in_app",
    payload: input.payload || {}
  });

  if (!error) {
    try {
      let targetUserId = input.userId || null;
      if (!targetUserId && input.businessId) {
        const { data } = await admin
          .from("businesses")
          .select("owner_id")
          .eq("id", input.businessId)
          .maybeSingle();
        targetUserId = data?.owner_id || null;
      }

      if (targetUserId) {
        await sendPushToUser({
          userId: targetUserId,
          title: String(input.payload?.title || "Diamond Studio by Nicole"),
          body: String(input.payload?.body || "Tienes una nueva notificación."),
          data: input.payload || {}
        });
      }
    } catch {
      // Best-effort only for push.
    }
  }

  return { error };
}

export async function createUserNotification(input: UserNotificationInput) {
  const admin = getAdminSupabase();
  const { error } = await admin.from("notifications").insert({
    user_id: input.userId,
    business_id: input.businessId || null,
    appointment_id: input.appointmentId || null,
    kind: input.kind,
    channel: "in_app",
    payload: input.payload || {}
  });

  if (!error) {
    try {
      await sendPushToUser({
        userId: input.userId,
        title: String(input.payload?.title || "Diamond Studio by Nicole"),
        body: String(input.payload?.body || "Tienes una nueva notificación."),
        data: input.payload || {}
      });
    } catch {
      // Best-effort only for push.
    }
  }

  return { error };
}

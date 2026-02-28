"use client";

import { useEffect, useMemo } from "react";

import { getClientSupabase } from "@/lib/supabase/client";

declare global {
  interface Window {
    OneSignal?: any;
    __onesignalInitialized?: boolean;
  }
}

export function OneSignalProvider() {
  const supabase = useMemo(() => getClientSupabase(), []);

  useEffect(() => {
    try {
      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      if (!appId || typeof window === "undefined" || !window.OneSignal) return;

      const OneSignal = window.OneSignal;
      if (typeof OneSignal.init !== "function") return;

      const applyUser = (userId?: string | null) => {
        if (!userId) return;
        if (typeof OneSignal.login === "function") {
          OneSignal.login(userId);
        } else if (typeof OneSignal.setExternalUserId === "function") {
          OneSignal.setExternalUserId(userId);
        }
      };

      const initPromise = window.__onesignalInitialized
        ? Promise.resolve()
        : Promise.resolve(
            OneSignal.init({
              appId,
              allowLocalhostAsSecureOrigin: true
            })
          ).then(() => {
            window.__onesignalInitialized = true;
          });

      initPromise
        .then(() => OneSignal.isPushNotificationsEnabled?.())
        .then((enabled: boolean) => {
          if (!enabled && OneSignal.showSlidedownPrompt) {
            OneSignal.showSlidedownPrompt();
          }
        })
        .catch(() => undefined);

      supabase.auth.getSession().then(({ data }) => {
        initPromise.then(() => applyUser(data.session?.user?.id)).catch(() => undefined);
      });

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        initPromise.then(() => applyUser(session?.user?.id)).catch(() => undefined);
      });

      return () => {
        sub?.subscription?.unsubscribe();
      };
    } catch {
      return;
    }
  }, [supabase]);

  return null;
}

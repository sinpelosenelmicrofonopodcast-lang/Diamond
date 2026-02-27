import { cookies } from "next/headers";

import { defaultLocale, type Locale, resolveTranslation } from "@/lib/i18n/translations";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("diamond_locale")?.value || store.get("luxapp_locale")?.value;
  return value === "en" || value === "es" ? value : defaultLocale;
}

export async function getServerT() {
  const locale = await getServerLocale();
  return {
    locale,
    t: (key: string) => resolveTranslation(locale, key)
  };
}

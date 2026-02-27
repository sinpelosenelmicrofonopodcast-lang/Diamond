"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { defaultLocale, type Locale, resolveTranslation } from "@/lib/i18n/translations";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  tx: (es: string, en: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);

  function setLocale(next: Locale) {
    setLocaleState(next);
    document.cookie = `diamond_locale=${next}; path=/; max-age=31536000`;
    void fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next })
    }).catch(() => undefined);
  }

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string) => resolveTranslation(locale, key),
      tx: (es: string, en: string) => (locale === "en" ? en : es)
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: defaultLocale,
      setLocale: () => undefined,
      t: (key: string) => resolveTranslation(defaultLocale, key),
      tx: (es: string, en: string) => (defaultLocale === "en" ? en : es)
    };
  }
  return ctx;
}

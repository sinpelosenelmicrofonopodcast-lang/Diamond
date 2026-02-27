"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/locale-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t, tx } = useLocale();
  const links = [
    [t("dashboard.overview"), "/dashboard/overview"],
    [t("dashboard.business"), "/dashboard/business"],
    [t("dashboard.calendar"), "/dashboard/calendar"],
    [t("dashboard.appointments"), "/dashboard/appointments"],
    [t("dashboard.staff"), "/dashboard/staff"],
    [t("dashboard.services"), "/dashboard/services"],
    [t("dashboard.schedule"), "/dashboard/schedule"],
    [t("dashboard.policies"), "/dashboard/policies"],
    [t("dashboard.payments"), "/dashboard/payments"],
    [t("dashboard.clients"), "/dashboard/clients"],
    [tx("Reviews", "Reviews"), "/dashboard/reviews"]
  ] as const;

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 md:grid-cols-[220px_1fr]">
      <aside className="lux-card h-fit space-y-1 p-3">
        <p className="px-2 pb-2 font-display text-xl text-softGold">{tx("Diamond Panel", "Diamond Panel")}</p>
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="block rounded-xl px-3 py-2 text-sm text-coolSilver hover:bg-gold/10 hover:text-softGold">
            {label}
          </Link>
        ))}
      </aside>
      <section className="space-y-4">{children}</section>
    </main>
  );
}

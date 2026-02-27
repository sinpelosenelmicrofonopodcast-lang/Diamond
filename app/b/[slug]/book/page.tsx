import Image from "next/image";
import { addDays, addHours, endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { redirect } from "next/navigation";
import { BookingForm } from "@/components/booking/booking-form";
import { Card } from "@/components/ui/card";
import { ReviewSection } from "@/components/reviews/review-section";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons/social";
import { generateSmartSlots } from "@/lib/booking/smart-slots";
import { getServerLocale } from "@/lib/i18n/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getBusinessBySlug } from "@/lib/queries";
import { SINGLE_BUSINESS_SLUG, isSingleBusinessSlug } from "@/lib/single-business";

function applyBusinessTime(baseDate: Date, timeValue: string) {
  const [hhRaw, mmRaw] = timeValue.split(":");
  const hh = Number(hhRaw || 0);
  const mm = Number(mmRaw || 0);
  const next = new Date(baseDate);
  next.setHours(hh, mm, 0, 0);
  return next;
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSingleBusinessSlug(slug)) {
    redirect(`/b/${SINGLE_BUSINESS_SLUG}/book`);
  }
  const { business, services, staff, policies, paymentMethods, reviews } = await getBusinessBySlug(slug);
  const locale = await getServerLocale();
  const tx = (es: string, en: string) => (locale === "en" ? en : es);
  const socialLinks = [
    { key: "instagram", label: "Instagram", url: business?.instagram_url, icon: InstagramIcon },
    { key: "facebook", label: "Facebook", url: business?.facebook_url, icon: FacebookIcon },
    { key: "tiktok", label: "TikTok", url: business?.tiktok_url, icon: TikTokIcon }
  ].filter((item) => item.url);
  const methodBrand: Record<string, { label: string; icon: string; color: string }> = {
    stripe: { label: tx("Tarjeta (Stripe)", "Card (Stripe)"), icon: "💳", color: "text-sky-300" },
    zelle: { label: "Zelle", icon: "Z", color: "text-violet-300" },
    paypal: { label: "PayPal", icon: "P", color: "text-blue-300" },
    cashapp: { label: "Cash App", icon: "$", color: "text-emerald-300" },
    cash: { label: tx("Cash al momento", "Cash on site"), icon: "💵", color: "text-amber-300" },
    other: { label: tx("Otro", "Other"), icon: "•", color: "text-coolSilver" }
  };
  const availablePaymentMethods = paymentMethods || [];
  const bookableStaff = (staff || []).filter((member: any) => Boolean(member.avatar_url));

  if (!business) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <h1 className="font-display text-3xl">{tx("Reserva no disponible", "Booking unavailable")}</h1>
          <p className="mt-3 text-coolSilver">
            {tx("No se encontró el perfil del negocio. Regresa al inicio e intenta de nuevo.", "Business profile not found. Go back home and try again.")}
          </p>
          <a className="mt-4 inline-flex rounded-2xl border border-gold/30 px-4 py-2 text-softGold hover:bg-gold/10" href="/">
            {tx("Volver al inicio", "Back to home")}
          </a>
        </Card>
      </main>
    );
  }

  const now = new Date();
  const bookingWindowEnd = addDays(now, 30);
  const timeZone = business.timezone || "UTC";
  const zonedNow = toZonedTime(now, timeZone);
  const leadDays = policies?.booking_lead_days ?? 0;
  const primaryService = services[0];
  const primaryStaff = bookableStaff[0];
  let slots: Array<{ staffId: string; startsAt: string; endsAt: string; score: number; recommended: boolean }> = [];

  if (primaryService && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = getAdminSupabase();
    const leadStartZoned = leadDays > 0 ? startOfDay(addDays(zonedNow, leadDays)) : zonedNow;
    const rangeStartZoned = startOfDay(leadStartZoned);
    const rangeEndZoned = endOfDay(addDays(zonedNow, 30));
    const rangeStart = fromZonedTime(rangeStartZoned, timeZone);
    const rangeEnd = fromZonedTime(rangeEndZoned, timeZone);
    const leadStartUtc = fromZonedTime(leadStartZoned, timeZone);

    let busyQuery = admin
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("business_id", business.id)
      .in("status", ["pending_confirmation", "confirmed", "awaiting_payment", "paid"])
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString());

    // When business has no explicit staff, we calculate availability against whole-business blocks.
    if (primaryStaff && !primaryStaff.id.startsWith("fallback-")) {
      busyQuery = busyQuery.eq("staff_id", primaryStaff.id);
    }

    const [{ data: busyRows }, { data: schedules }, { data: blocks }] = await Promise.all([
      busyQuery,
      admin
        .from("business_schedules")
        .select("weekday, start_time, end_time, is_closed, slot_granularity_min")
        .eq("business_id", business.id),
      admin
        .from("business_time_blocks")
        .select("starts_at, ends_at")
        .eq("business_id", business.id)
    ]);

    const busyRanges = (busyRows || []).map((row) => ({
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at || row.starts_at)
    }));
    const blockRanges = (blocks || []).map((row) => ({
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at || row.starts_at)
    }));

    const generated = Array.from({ length: 31 }).flatMap((_, dayOffset) => {
      const dayZoned = addDays(startOfDay(zonedNow), dayOffset);
      if (dayZoned < rangeStartZoned) return [];
      const weekday = dayZoned.getDay();
      const schedule = (schedules || []).find((item) => item.weekday === weekday);

      if (schedule?.is_closed) return [];

      const startTime = schedule?.start_time || "09:00:00";
      const endTime = schedule?.end_time || "18:00:00";
      const granularity = schedule?.slot_granularity_min || 15;
      const dayStartLocal = applyBusinessTime(startOfDay(dayZoned), startTime);
      const dayEndLocal = applyBusinessTime(startOfDay(dayZoned), endTime);
      const dayStart = fromZonedTime(dayStartLocal, timeZone);
      const dayEnd = fromZonedTime(dayEndLocal, timeZone);

      if (dayEnd <= dayStart) return [];
      const dayBusy = busyRanges.filter((item) => item.startsAt >= dayStart && item.startsAt <= dayEnd);
      const dayBlocks = blockRanges.filter((item) => item.startsAt <= dayEnd && item.endsAt >= dayStart);
      const combinedBusy = [...dayBusy, ...dayBlocks];

      return generateSmartSlots({
        staffId: primaryStaff?.id || `business-${business.id}`,
        workStart: dayStart,
        workEnd: dayEnd,
        serviceDurationMin: primaryService.duration_min,
        bufferBeforeMin: primaryService.buffer_before_min || 0,
        bufferAfterMin: primaryService.buffer_after_min || 0,
        granularityMin: granularity,
        busy: combinedBusy
      }).filter((slot) => new Date(slot.startsAt) >= leadStartUtc);
    });

    slots = generated;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="lux-card overflow-hidden p-0">
        <div className="relative h-52 w-full">
          {business.cover_url ? (
            <Image src={business.cover_url} alt={`Cover ${business.name}`} fill className="object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-gold/20 to-silver/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-5 left-5 flex items-end gap-3">
            {business.logo_url ? (
              <Image
                src={business.logo_url}
                alt={`Logo ${business.name}`}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-2xl border border-gold/40 object-cover"
              />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-gold/40 bg-black/50 font-display text-2xl text-softGold">
                {business.name.slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl text-textWhite md:text-4xl">{tx("Reserva en", "Book at")} {business.name}</h1>
              <p className="text-sm text-coolSilver">{business.city} · {business.category} · {business.available_today ? tx("Disponible hoy", "Available today") : tx("Siguiente disponibilidad pronto", "Next availability soon")}</p>
              <p className="text-xs text-softGold">
                {tx("Agenda abierta hasta", "Booking open until")} {bookingWindowEnd.toLocaleDateString(locale === "en" ? "en-US" : "es-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {socialLinks.length ? (
        <Card>
          <h2 className="font-display text-2xl">{tx("Redes sociales", "Social links")}</h2>
          <p className="mt-1 text-sm text-mutedText">{tx("Conecta con el negocio en sus redes.", "Connect with the business on social media.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {socialLinks.map((item) => (
              <a
                key={item.key}
                href={item.url as string}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-gold/30 px-3 py-2 text-softGold hover:bg-gold/10"
                aria-label={item.label}
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      <BookingForm
        businessId={business.id}
        services={services}
        staff={bookableStaff}
        slots={slots}
        cancelMinutes={policies?.min_cancel_minutes ?? 240}
        lateToleranceMinutes={policies?.late_tolerance_minutes ?? 10}
        depositPercent={policies?.base_deposit_percent ?? 0}
        depositMode={policies?.deposit_mode || "none"}
        fixedDepositCents={policies?.fixed_deposit_cents ?? null}
        bookingLeadDays={policies?.booking_lead_days ?? 0}
        timeZone={business.timezone || "UTC"}
      />

      <Card>
        <h2 className="font-display text-2xl">5. {tx("Métodos de pago disponibles", "Available payment methods")}</h2>
        <p className="mt-1 text-sm text-mutedText">{tx("El negocio controla cómo deseas pagar. Puedes abrir la app correspondiente con un toque.", "The business controls how you pay. You can open the corresponding app with one tap.")}</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {availablePaymentMethods.length === 0 ? (
            <p className="text-sm text-coolSilver">{tx("Este negocio no ha configurado métodos de pago aún.", "This business has not configured payment methods yet.")}</p>
          ) : (
            availablePaymentMethods.map((item: any) => {
              const brand = methodBrand[item.method] || methodBrand.other;
              const href =
                item.payment_url ||
                (item.method === "paypal" && item.account_value ? `https://paypal.me/${item.account_value.replace(/^@/, "")}` : "") ||
                (item.method === "cashapp" && item.account_value
                  ? `https://cash.app/${item.account_value.startsWith("$") ? item.account_value : `$${item.account_value}`}`
                  : "") ||
                (item.method === "zelle" ? "https://www.zellepay.com/" : "");

              const maskedAccount = item.account_value
                ? item.account_value.length > 6
                  ? `${item.account_value.slice(0, 2)}•••${item.account_value.slice(-2)}`
                  : `${item.account_value.slice(0, 1)}•••`
                : null;

              return (
                <div key={item.method} className="rounded-2xl border border-silver/20 bg-black/40 p-3">
                  <p className={`text-sm font-semibold ${brand.color}`}>
                    <span className="mr-2">{brand.icon}</span>
                    {brand.label}
                  </p>
                  {maskedAccount ? <p className="mt-1 text-sm text-coolSilver">{maskedAccount}</p> : null}
                  {item.notes ? <p className="mt-1 text-xs text-mutedText">{item.notes}</p> : null}
                  {href ? (
                    <a
                      className="mt-2 inline-flex text-xs text-softGold underline-offset-4 hover:underline"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tx("Ver instrucciones", "View instructions")}
                    </a>
                  ) : (
                    <span className="mt-2 inline-flex text-xs text-mutedText">
                      {tx("Ver instrucciones", "View instructions")}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      <ReviewSection businessId={business.id} initialReviews={reviews || []} />
    </main>
  );
}

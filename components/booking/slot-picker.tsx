"use client";

import { useMemo, useState } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SlotOption } from "@/types/domain";

function getDayKey(iso: string, timeZone?: string) {
  if (!timeZone) return iso.slice(0, 10);
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function formatDayLabel(iso: string, locale: "es" | "en", timeZone?: string) {
  const date = new Date(iso);
  return date.toLocaleDateString(locale === "en" ? "en-US" : "es-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTimeLabel(iso: string, locale: "es" | "en", timeZone?: string) {
  return new Date(iso).toLocaleTimeString(locale === "en" ? "en-US" : "es-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

export function SlotPicker({
  slots,
  selectedSlotKey,
  onSelectSlot,
  timeZone
}: {
  slots: SlotOption[];
  selectedSlotKey?: string | null;
  onSelectSlot?: (slot: SlotOption) => void;
  timeZone?: string;
}) {
  const { locale, t } = useLocale();
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const dates = useMemo(() => {
    const map = new Map<string, string>();
    slots.forEach((slot) => {
      const key = getDayKey(slot.startsAt, timeZone);
      if (!map.has(key)) {
        map.set(key, formatDayLabel(slot.startsAt, locale, timeZone));
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [slots, locale, timeZone]);

  const [activeDate, setActiveDate] = useState<string | null>(dates[0]?.key ?? null);

  const filteredByDate = useMemo(() => {
    if (!activeDate) return slots;
    return slots.filter((slot) => getDayKey(slot.startsAt, timeZone) === activeDate);
  }, [slots, activeDate, timeZone]);

  const recommended = useMemo(() => filteredByDate.filter((slot) => slot.recommended).slice(0, 8), [filteredByDate]);
  const visible = showAll ? filteredByDate : recommended;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dates.map((date) => (
          <Button
            key={date.key}
            type="button"
            size="sm"
            variant={activeDate === date.key ? "default" : "secondary"}
            className="shrink-0"
            onClick={() => setActiveDate(date.key)}
          >
            {date.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-softGold">{t("booking.recommendedSlots")}</p>
        <button className="text-xs text-coolSilver hover:text-softGold" onClick={() => setShowAll((v) => !v)} type="button">
          {showAll ? t("booking.viewRecommended") : t("booking.viewAll")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {visible.map((slot) => {
          const key = `${slot.staffId}-${slot.startsAt}`;
          const label = formatTimeLabel(slot.startsAt, locale, timeZone);
          const active = (selectedSlotKey ?? selected) === key;
          return (
            <Button
              key={key}
              type="button"
              variant={active ? "default" : "secondary"}
              className={cn("h-11 rounded-xl", active && "ring-2 ring-gold")}
              onClick={() => {
                setSelected(key);
                onSelectSlot?.(slot);
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

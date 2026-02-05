import { addDays, endOfDay, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { NextResponse } from "next/server";
import { z } from "zod";

import { generateSmartSlots } from "@/lib/booking/smart-slots";
import { getAdminSupabase } from "@/lib/supabase/admin";

const schema = z.object({
  businessId: z.string().uuid(),
  staffId: z.string().uuid().or(z.string().min(1)),
  serviceDurationMin: z.number().min(5),
  bufferBeforeMin: z.number().min(0).default(0),
  bufferAfterMin: z.number().min(0).default(0)
});

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local" }, { status: 500 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const now = new Date();
  const { data: policy } = await admin
    .from("business_policies")
    .select("booking_lead_days")
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();
  const { data: business } = await admin
    .from("businesses")
    .select("timezone")
    .eq("id", parsed.data.businessId)
    .maybeSingle();

  const timeZone = business?.timezone || "UTC";
  const zonedNow = toZonedTime(now, timeZone);

  const leadDays = policy?.booking_lead_days ?? 0;
  const leadStartZoned = leadDays > 0 ? startOfDay(addDays(zonedNow, leadDays)) : zonedNow;
  const rangeStartZoned = startOfDay(leadStartZoned);
  const rangeEndZoned = endOfDay(addDays(zonedNow, 30));
  const rangeStart = fromZonedTime(rangeStartZoned, timeZone);
  const rangeEnd = fromZonedTime(rangeEndZoned, timeZone);
  const leadStartUtc = fromZonedTime(leadStartZoned, timeZone);

  let busyQuery = admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("business_id", parsed.data.businessId)
    .in("status", ["pending_confirmation", "confirmed", "awaiting_payment", "paid"])
    .gte("starts_at", rangeStart.toISOString())
    .lte("starts_at", rangeEnd.toISOString());

  if (!String(parsed.data.staffId).startsWith("fallback-")) {
    busyQuery = busyQuery.eq("staff_id", parsed.data.staffId);
  }

  const [{ data: busyRows }, { data: schedules }, { data: blocks }] = await Promise.all([
    busyQuery,
    admin
      .from("business_schedules")
      .select("weekday, start_time, end_time, is_closed, slot_granularity_min")
      .eq("business_id", parsed.data.businessId),
    admin
      .from("business_time_blocks")
      .select("starts_at, ends_at")
      .eq("business_id", parsed.data.businessId)
  ]);

  const busyRanges = (busyRows || []).map((row) => ({
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at || row.starts_at)
  }));
  const blockRanges = (blocks || []).map((row) => ({
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at || row.starts_at)
  }));

  const slots = Array.from({ length: 31 }).flatMap((_, dayOffset) => {
    const dayZoned = addDays(startOfDay(zonedNow), dayOffset);
    if (dayZoned < rangeStartZoned) return [];
    const weekday = dayZoned.getDay();
    const schedule = (schedules || []).find((item) => item.weekday === weekday);

    if (schedule?.is_closed) return [];

    const startTime = schedule?.start_time || "09:00:00";
    const endTime = schedule?.end_time || "18:00:00";
    const granularity = schedule?.slot_granularity_min || 15;

    const dayStartLocal = new Date(dayZoned);
    const [startH, startM] = startTime.split(":");
    dayStartLocal.setHours(Number(startH || 0), Number(startM || 0), 0, 0);

    const dayEndLocal = new Date(dayZoned);
    const [endH, endM] = endTime.split(":");
    dayEndLocal.setHours(Number(endH || 0), Number(endM || 0), 0, 0);

    const dayStart = fromZonedTime(dayStartLocal, timeZone);
    const dayEnd = fromZonedTime(dayEndLocal, timeZone);

    if (dayEnd <= dayStart) return [];

    const dayBusy = busyRanges.filter((item) => item.startsAt >= dayStart && item.startsAt <= dayEnd);
    const dayBlocks = blockRanges.filter((item) => item.startsAt <= dayEnd && item.endsAt >= dayStart);
    const combinedBusy = [...dayBusy, ...dayBlocks];

    return generateSmartSlots({
      staffId: parsed.data.staffId,
      workStart: dayStart,
      workEnd: dayEnd,
      serviceDurationMin: parsed.data.serviceDurationMin,
      bufferBeforeMin: parsed.data.bufferBeforeMin,
      bufferAfterMin: parsed.data.bufferAfterMin,
      granularityMin: granularity,
      busy: combinedBusy
    }).filter((slot) => new Date(slot.startsAt) >= leadStartUtc);
  });

  return NextResponse.json({ slots });
}

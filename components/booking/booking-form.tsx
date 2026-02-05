"use client";

import { useEffect, useMemo, useState } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { PolicyNotice } from "@/components/booking/policy-notice";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getClientSupabase } from "@/lib/supabase/client";
import type { SlotOption } from "@/types/domain";

type ServiceItem = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  price_starts_at?: boolean;
  image_url?: string | null;
  buffer_before_min?: number;
  buffer_after_min?: number;
  requires_confirmation?: boolean;
};

type StaffItem = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
};

export function BookingForm({
  businessId,
  services,
  staff,
  slots,
  cancelMinutes,
  lateToleranceMinutes,
  depositPercent,
  bookingLeadDays,
  timeZone
}: {
  businessId: string;
  services: ServiceItem[];
  staff: StaffItem[];
  slots: SlotOption[];
  cancelMinutes: number;
  lateToleranceMinutes: number;
  depositPercent: number;
  bookingLeadDays?: number;
  timeZone?: string;
}) {
  const { t, tx } = useLocale();
  const supabase = useMemo(() => getClientSupabase(), []);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(services[0]?.id ? [services[0].id] : []);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id || "");
  const [guestCount, setGuestCount] = useState(0);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [selectedStartsAt, setSelectedStartsAt] = useState<string>("");
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>(slots);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [requiredDepositPercent, setRequiredDepositPercent] = useState(depositPercent);
  const [requiredDepositCents, setRequiredDepositCents] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedServices = useMemo(
    () => services.filter((item) => selectedServiceIds.includes(item.id)),
    [services, selectedServiceIds]
  );

  const basePriceCents = useMemo(
    () => selectedServices.reduce((acc, item) => acc + (item.price_cents || 0), 0),
    [selectedServices]
  );

  const baseDurationMin = useMemo(
    () => selectedServices.reduce((acc, item) => acc + (item.duration_min || 0), 0),
    [selectedServices]
  );

  const baseBufferBeforeMin = useMemo(
    () => selectedServices.reduce((acc, item) => acc + (item.buffer_before_min || 0), 0),
    [selectedServices]
  );

  const baseBufferAfterMin = useMemo(
    () => selectedServices.reduce((acc, item) => acc + (item.buffer_after_min || 0), 0),
    [selectedServices]
  );

  const hasVariablePrice = useMemo(
    () => selectedServices.some((item) => item.price_starts_at),
    [selectedServices]
  );

  const multiplier = guestCount === 1 ? 2 : 1;
  const totalPriceCents = basePriceCents * multiplier;
  const totalDurationMin = baseDurationMin * multiplier;
  const depositCents = requiredDepositCents || Math.round(totalPriceCents * (requiredDepositPercent / 100));

  function toggleService(serviceId: string) {
    setSelectedSlotKey(null);
    setSelectedStartsAt("");
    setMessage(null);
    setSelectedServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== serviceId);
      }
      return [...prev, serviceId];
    });
  }

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMessage(tx("Inicia sesión para reservar. Usaremos tu perfil automáticamente.", "Sign in to book. We will use your profile automatically."));
        setProfileReady(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", auth.user.id)
        .maybeSingle();

      setProfileName(profile?.full_name || auth.user.user_metadata?.full_name || "");
      setProfilePhone(profile?.phone || auth.user.user_metadata?.phone || "");
      setProfileEmail(profile?.email || auth.user.email || "");
      setProfileReady(true);
    })();
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    async function estimateDeposit() {
      if (!selectedServices.length) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      setEstimating(true);
      try {
        const res = await fetch("/api/bookings/estimate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            businessId,
            serviceIds: selectedServices.map((item) => item.id),
            guestCount,
            businessDepositPercent: depositPercent,
            clientEmail: profileEmail || undefined
          })
        });
        const payload = await res.json();
        if (!cancelled && res.ok) {
          setRequiredDepositPercent(payload.requiredDepositPercent ?? depositPercent);
          setRequiredDepositCents(payload.requiredDepositCents ?? 0);
        }
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }

    estimateDeposit();
    return () => {
      cancelled = true;
    };
  }, [businessId, selectedServiceIds.join(","), guestCount, depositPercent, profileEmail, supabase]);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      if (!selectedServices.length) {
        setSlotOptions([]);
        return;
      }
      const staffId = selectedStaffId || staff[0]?.id || "";
      if (!staffId) {
        setSlotOptions([]);
        return;
      }
      setLoadingSlots(true);
      try {
        const res = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            staffId,
            serviceDurationMin: totalDurationMin,
            bufferBeforeMin: baseBufferBeforeMin,
            bufferAfterMin: baseBufferAfterMin
          })
        });
        const payload = await res.json();
        if (!cancelled && res.ok) {
          setSlotOptions(payload.slots || []);
        }
      } catch {
        if (!cancelled) setSlotOptions([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [businessId, selectedStaffId, selectedServiceIds.join(","), totalDurationMin, baseBufferBeforeMin, baseBufferAfterMin, staff]);

  useEffect(() => {
    setSelectedSlotKey(null);
    setSelectedStartsAt("");
  }, [guestCount]);

  async function onConfirm() {
    if (!selectedServices.length) {
      setMessage(t("booking.selectService"));
      return;
    }
    if (!selectedStartsAt) {
      setMessage(t("booking.selectSlot"));
      return;
    }
    if (!profileReady || !profileEmail || !profileName || !profilePhone) {
      setMessage(tx("Completa tu perfil (nombre, teléfono, email) antes de reservar.", "Complete your profile (name, phone, email) before booking."));
      return;
    }

    setLoading(true);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        businessId,
        serviceIds: selectedServices.map((item) => item.id),
        staffId: selectedStaffId || null,
        startsAt: selectedStartsAt,
        clientEmail: profileEmail,
        guestCount,
        businessDepositPercent: depositPercent
      })
    });

    const payload = await res.json();

    if (!res.ok) {
      setMessage(payload.error || tx("No se pudo crear la reserva.", "Could not create booking."));
      setLoading(false);
      return;
    }

    setLoading(false);
    setMessage(`${t("booking.bookingCreated")} ${payload.appointment?.status || "confirmed"}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl">1. {t("booking.service")}</h2>
          <p className="mt-1 text-sm text-mutedText">{tx("Selecciona el servicio ideal para tu cita.", "Select the ideal service for your appointment.")}</p>
          <div className="mt-4 space-y-2 text-sm text-coolSilver">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => toggleService(service.id)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                  selectedServiceIds.includes(service.id) ? "border-softGold bg-gold/10" : "border-silver/20 bg-black/40 hover:border-softGold"
                }`}
              >
                <span className="flex items-center gap-3">
                  {"image_url" in service && service.image_url ? (
                    <img src={service.image_url as string} alt={service.name} className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-silver/20 text-[10px] text-coolSilver">
                      {tx("Foto", "Photo")}
                    </div>
                  )}
                  <span>
                    <span className="block text-textWhite">{service.name}</span>
                    <span className="text-xs text-mutedText">
                      {service.duration_min} min · {service.price_starts_at ? `${tx("Desde", "From")} $${(service.price_cents / 100).toFixed(2)}` : `$${(service.price_cents / 100).toFixed(2)}`}
                    </span>
                    {requiredDepositPercent > 0 ? (
                      <span className="mt-1 block text-[11px] text-softGold">
                        {tx("Requiere depósito", "Requires deposit")}: {requiredDepositPercent}%
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="text-xs text-softGold">
                  {selectedServiceIds.includes(service.id) ? tx("Seleccionado", "Selected") : tx("Agregar", "Add")}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-silver/20 bg-black/40 p-3 text-sm text-coolSilver">
            <p className="text-softGold">{tx("Resumen de servicios", "Service summary")}</p>
            <p>
              {tx("Servicios", "Services")}: {selectedServices.length} · {tx("Duración", "Duration")}: {totalDurationMin} min
            </p>
            <p>
              {tx("Precio total", "Total price")}: {hasVariablePrice ? `${tx("Desde", "From")} ` : ""}${(totalPriceCents / 100).toFixed(2)}
            </p>
            <p>
              {tx("Depósito estimado", "Estimated deposit")}: ${(depositCents / 100).toFixed(2)} {estimating ? `(${tx("calculando", "calculating")}...)` : ""}
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={guestCount === 1} onChange={(e) => setGuestCount(e.target.checked ? 1 : 0)} />
              {tx("Agregar 1 guest (misma selección de servicios)", "Add 1 guest (same service selection)")}
            </label>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl">2. {t("booking.staff")}</h2>
          <p className="mt-1 text-sm text-mutedText">{tx("Elige quién te atenderá.", "Choose who will serve you.")}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {staff.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedStaffId(member.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  selectedStaffId === member.id ? "border-softGold bg-gold/10" : "border-silver/20 bg-black/40 hover:border-softGold"
                }`}
              >
                <span className="text-textWhite">{member.display_name}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-2xl">3. {t("booking.dateTime")}</h2>
        <p className="mt-1 text-sm text-mutedText">{tx("Selecciona un horario disponible.", "Select an available time.")}</p>
        {timeZone ? (
          <p className="mt-1 text-xs text-coolSilver">
            {tx("Horario del negocio", "Business time zone")}: {timeZone}
          </p>
        ) : null}
        {bookingLeadDays && bookingLeadDays > 0 ? (
          <p className="mt-1 text-xs text-coolSilver">
            {tx("Reservas disponibles con", "Bookings available with")} {bookingLeadDays} {tx("dias de anticipacion", "days of advance notice")}.
          </p>
        ) : null}
        <div className="mt-4">
          {loadingSlots ? (
            <p className="text-sm text-coolSilver">{tx("Calculando disponibilidad...", "Calculating availability...")}</p>
          ) : (
            <SlotPicker
              slots={slotOptions}
              selectedSlotKey={selectedSlotKey}
              onSelectSlot={(slot) => {
                setSelectedSlotKey(`${slot.staffId}-${slot.startsAt}`);
                setSelectedStartsAt(slot.startsAt);
                if (slot.staffId) setSelectedStaffId(slot.staffId);
              }}
              timeZone={timeZone}
            />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl">4. {t("booking.contact")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Input value={profileName} disabled placeholder={tx("Nombre", "Name")} />
          <Input value={profilePhone} disabled placeholder={tx("Teléfono", "Phone")} />
          <Input
            placeholder={tx("Email", "Email")}
            type="email"
            value={profileEmail}
            disabled
          />
        </div>
      </Card>

      <PolicyNotice
        cancellationMinutes={cancelMinutes}
        lateToleranceMinutes={lateToleranceMinutes}
        depositPercent={requiredDepositPercent}
        bookingLeadDays={bookingLeadDays}
      />

      <Button className="w-full" size="lg" onClick={onConfirm} disabled={loading || !profileReady || !services.length || !slotOptions.length}>
        {loading ? "..." : t("booking.confirmBooking")}
      </Button>

      {message ? <p className="text-sm text-coolSilver">{message}</p> : null}
    </div>
  );
}

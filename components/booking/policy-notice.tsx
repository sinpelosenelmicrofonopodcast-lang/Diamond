"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PolicyNotice({
  cancellationMinutes,
  lateToleranceMinutes,
  depositPercent,
  bookingLeadDays,
  depositMode,
  fixedDepositCents
}: {
  cancellationMinutes: number;
  lateToleranceMinutes: number;
  depositPercent: number;
  bookingLeadDays?: number;
  depositMode?: "none" | "fixed" | "percent" | "full";
  fixedDepositCents?: number | null;
}) {
  const { t, tx } = useLocale();
  const cancellationHours = Math.max(1, Math.round(cancellationMinutes / 60));
  const depositLabel =
    depositMode === "fixed"
      ? `${tx("Depósito fijo", "Fixed deposit")}: $${((fixedDepositCents || 0) / 100).toFixed(2)}.`
      : depositMode === "full"
        ? tx("Pago completo requerido.", "Full payment required.")
        : depositMode === "percent"
          ? `${t("booking.requiredDeposit")}: ${depositPercent}%.`
          : tx("Sin depósito requerido.", "No deposit required.");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("booking.policiesTitle")}</CardTitle>
        <CardDescription>{tx("Confirmas que aceptas estos términos del negocio.", "You confirm that you accept this business policy.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-coolSilver">
        <p>{t("booking.cancellation")}: {cancellationHours} {tx("horas", "hours")}.</p>
        <p>{t("booking.lateTolerance")}: {lateToleranceMinutes} {tx("minutos", "minutes")}.</p>
        {bookingLeadDays && bookingLeadDays > 0 ? (
          <p>{tx("Antelacion minima", "Minimum advance")}: {bookingLeadDays} {tx("dias", "days")}.</p>
        ) : null}
        <p>{depositLabel}</p>
        <p>
          {tx(
            `Política de depósito: no es reembolsable si cancelas dentro de ${cancellationHours} horas antes de tu cita.`,
            `Deposit policy: it is non-refundable if you cancel within ${cancellationHours} hours before your appointment.`
          )}
        </p>
      </CardContent>
    </Card>
  );
}

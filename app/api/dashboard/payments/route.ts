import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardContext } from "@/lib/server/dashboard-auth";

const schema = z.object({
  deposit_mode: z.enum(["none", "fixed", "percent", "full"]),
  base_deposit_percent: z.number().int().min(0).max(100),
  fixed_deposit_cents: z.number().int().min(0).nullable(),
  pay_later_allowed: z.boolean(),
  external_payments_enabled: z.boolean(),
  accepted_methods: z.array(z.enum(["stripe", "cash", "zelle", "paypal", "cashapp", "other"])).min(1),
  method_details: z
    .record(
      z.enum(["stripe", "cash", "zelle", "paypal", "cashapp", "other"]),
      z.object({
        account_label: z.string().optional(),
        account_value: z.string().optional(),
        payment_url: z.string().optional(),
        notes: z.string().optional()
      })
    )
    .optional()
});

export async function GET(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const admin = getAdminSupabase();
  const [{ data, error: queryError }, { data: methods, error: methodsError }] = await Promise.all([
    admin
      .from("business_policies")
      .select("deposit_mode, base_deposit_percent, fixed_deposit_cents, pay_later_allowed, external_payments_enabled")
      .eq("business_id", ctx.businessId)
      .maybeSingle(),
    admin
      .from("business_payment_methods")
      .select("method, account_label, account_value, payment_url, notes")
      .eq("business_id", ctx.businessId)
      .eq("is_enabled", true)
  ]);

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 400 });
  if (methodsError) return NextResponse.json({ error: methodsError.message }, { status: 400 });

  const methodRows = (methods || []) as Array<{
    method: "stripe" | "cash" | "zelle" | "paypal" | "cashapp" | "other";
    account_label?: string | null;
    account_value?: string | null;
    payment_url?: string | null;
    notes?: string | null;
  }>;

  const accepted_methods = methodRows.map((item) => item.method);
  const method_details = methodRows.reduce(
    (acc, item) => {
      acc[item.method] = {
        account_label: item.account_label || "",
        account_value: item.account_value || "",
        payment_url: item.payment_url || "",
        notes: item.notes || ""
      };
      return acc;
    },
    {} as Record<string, { account_label: string; account_value: string; payment_url: string; notes: string }>
  );

  return NextResponse.json({
    payments: {
      ...data,
      accepted_methods: accepted_methods.length ? accepted_methods : ["stripe", "cash"],
      method_details
    }
  });
}

export async function POST(req: Request) {
  const { ctx, error, status } = await getDashboardContext(req);
  if (!ctx) return NextResponse.json({ error }, { status: status || 400 });

  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const admin = getAdminSupabase();
  const { accepted_methods, method_details = {}, ...policyPayload } = parsed.data;
  const { data, error: upsertError } = await admin
    .from("business_policies")
    .upsert(
      {
        business_id: ctx.businessId,
        ...policyPayload
      },
      { onConflict: "business_id" }
    )
    .select("deposit_mode, base_deposit_percent, fixed_deposit_cents, pay_later_allowed, external_payments_enabled")
    .single();

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });

  const { error: deleteMethodsError } = await admin.from("business_payment_methods").delete().eq("business_id", ctx.businessId);
  if (deleteMethodsError) return NextResponse.json({ error: deleteMethodsError.message }, { status: 400 });

  const rows = accepted_methods.map((method) => ({
    business_id: ctx.businessId,
    method,
    is_enabled: true,
    account_label: method_details?.[method]?.account_label || null,
    account_value: method_details?.[method]?.account_value || null,
    payment_url: method_details?.[method]?.payment_url || null,
    notes: method_details?.[method]?.notes || null
  }));

  const { error: insertMethodsError } = await admin.from("business_payment_methods").insert(rows);
  if (insertMethodsError) return NextResponse.json({ error: insertMethodsError.message }, { status: 400 });

  return NextResponse.json({ payments: { ...data, accepted_methods, method_details } });
}

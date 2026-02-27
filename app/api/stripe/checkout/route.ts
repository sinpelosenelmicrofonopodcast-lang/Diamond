import { NextResponse } from "next/server";
import { z } from "zod";

import { getStripe } from "@/lib/billing/stripe";

const schema = z.object({
  mode: z.literal("deposit"),
  amountCents: z.number().int().positive().optional(),
  businessId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  customerEmail: z.string().email()
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });

  if (!input.amountCents || !input.appointmentId) {
    return NextResponse.json({ error: "Faltan amountCents/appointmentId" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Depósito de cita · Diamond Studio by Nicole" },
          unit_amount: input.amountCents
        },
        quantity: 1
      }
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/appointments?paid=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/appointments?canceled=1`,
    metadata: {
      kind: "appointment_deposit",
      appointmentId: input.appointmentId,
      businessId: input.businessId || ""
    }
  });

  return NextResponse.json({ url: session.url });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  locale: z.enum(["es", "en"])
});

export async function POST(req: Request) {
  const payload = await req.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });

  const store = await cookies();
  store.set("diamond_locale", parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax"
  });
  store.delete("luxapp_locale");

  return NextResponse.json({ ok: true });
}

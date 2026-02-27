import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Diamond Studio by Nicole",
    short_name: "Diamond Studio",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0B0F",
    theme_color: "#0B0B0F"
  });
}

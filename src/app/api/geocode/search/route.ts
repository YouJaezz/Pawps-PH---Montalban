import { NextResponse } from "next/server";

import { searchAddresses } from "@/lib/geocode-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.trim().length < 3) {
    return NextResponse.json([]);
  }

  const results = await searchAddresses(q, 6);
  return NextResponse.json(results);
}

import { NextResponse } from "next/server";

import {
  buildCustomerPricelistHtml,
  getCustomerPricelistRows,
  type CustomerPriceTier,
} from "@/lib/customer-pricelist";
import { requireAdmin } from "@/lib/auth-guard";

function parseTier(raw: string | null): CustomerPriceTier | null {
  if (raw === "retail" || raw === "wholesale") return raw;
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const tier = parseTier(new URL(request.url).searchParams.get("tier"));
  if (!tier) {
    return NextResponse.json(
      { error: 'Choose tier=retail or tier=wholesale.' },
      { status: 400 },
    );
  }

  const rows = await getCustomerPricelistRows(tier);
  const html = buildCustomerPricelistHtml(tier, rows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `inline; filename="pawps-${tier}-pricelist-${dateStamp}.html"`,
    },
  });
}

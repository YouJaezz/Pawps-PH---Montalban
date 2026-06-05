import { db } from "@/db";
import { products } from "@/db/schema";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import { displayCatalogItemType } from "@/lib/catalog-item-types";
import { formatPhpFromCents } from "@/lib/money";
import type { StockUnit } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export type CustomerPriceTier = "retail" | "wholesale";

export type CustomerPricelistRow = {
  item: string;
  brand: string;
  flavor: string;
  itemType: string;
  packSize: string;
  priceCents: number;
  priceUnit: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priceUnitLabel(stockUnit: StockUnit, kgPerSack: number | null) {
  if (stockUnit === "Kilogram" || kgPerSack != null) return "per kg";
  if (stockUnit === "Sack") return "per sack";
  if (stockUnit === "Pack") return "per pack";
  return "per pc";
}

export async function getCustomerPricelistRows(
  tier: CustomerPriceTier,
): Promise<CustomerPricelistRow[]> {
  const rows = await db
    .select({
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      itemType: products.itemType,
      packSize: products.packSize,
      stockUnit: products.stockUnit,
      kgPerSack: products.kgPerSack,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
    })
    .from(products)
    .where(eq(products.archived, false))
    .orderBy(asc(products.brand), asc(products.name));

  const out: CustomerPricelistRow[] = [];

  for (const p of rows) {
    const priceCents = tier === "retail" ? p.retailPrice : p.bulkPrice;
    if (priceCents <= 0) continue;

    const item = displayCatalogItem(null, p.name);
    const brand = p.brand ? displayCatalogItem(null, p.brand) : "—";
    const flavor = p.variant?.trim()
      ? displayCatalogFlavor(p.variant, p.name)
      : "—";
    const packSize = p.packSize?.trim() ?? "";

    out.push({
      item,
      brand,
      flavor,
      itemType: displayCatalogItemType(p.itemType),
      packSize: packSize === "—" ? "" : packSize,
      priceCents,
      priceUnit: priceUnitLabel(p.stockUnit as StockUnit, p.kgPerSack),
    });
  }

  return out;
}

export function buildCustomerPricelistHtml(
  tier: CustomerPriceTier,
  rows: CustomerPricelistRow[],
) {
  const tierLabel = tier === "retail" ? "Retail" : "Wholesale";
  const priceColumnLabel =
    tier === "retail" ? "Retail price" : "Wholesale price";
  const date = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tableRows = rows
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.item)}</td>
        <td>${escapeHtml(r.brand)}</td>
        <td>${escapeHtml(r.flavor)}</td>
        <td>${escapeHtml(r.itemType)}</td>
        <td>${escapeHtml(r.packSize || "—")}</td>
        <td class="num price">${escapeHtml(formatPhpFromCents(r.priceCents))}<span class="unit"> / ${escapeHtml(r.priceUnit)}</span></td>
      </tr>`,
    )
    .join("");

  const emptyRow =
    rows.length === 0
      ? `<tr><td colspan="7" class="empty">No ${tierLabel.toLowerCase()} prices set on inventory items yet.</td></tr>`
      : tableRows;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(BRAND_NAME)} — ${escapeHtml(tierLabel)} Pricelist — ${escapeHtml(date)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #111; }
    .header { border-bottom: 3px solid #e8a44a; padding-bottom: 12px; margin-bottom: 20px; }
    .brand { font-size: 24px; font-weight: 700; color: #0f0f14; }
    .tagline { font-size: 12px; color: #666; margin-top: 2px; }
    .meta { font-size: 13px; margin-top: 8px; color: #333; }
    .tier { display: inline-block; margin-top: 6px; padding: 4px 10px; border-radius: 999px; background: #fff4e5; color: #8a5a12; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
    h2 { font-size: 16px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #13131f; color: #fff; }
    tr:nth-child(even) { background: #f8f8fa; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .price { font-weight: 600; color: #0f5132; }
    .unit { font-weight: 400; color: #666; font-size: 10px; }
    .empty { text-align: center; color: #666; padding: 20px; }
    .footer { margin-top: 16px; font-size: 10px; color: #888; line-height: 1.5; }
    @media print {
      body { margin: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">${escapeHtml(BRAND_NAME)}</div>
    <div class="tagline">${escapeHtml(BRAND_TAGLINE)}</div>
    <div class="meta">${escapeHtml(tierLabel)} price list · ${escapeHtml(date)} · ${rows.length} item${rows.length === 1 ? "" : "s"}</div>
    <div class="tier">${escapeHtml(tierLabel)} prices</div>
  </div>
  <h2>Product price list</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th>Brand</th>
        <th>Flavor</th>
        <th>Type</th>
        <th>Pack size</th>
        <th>${escapeHtml(priceColumnLabel)}</th>
      </tr>
    </thead>
    <tbody>${emptyRow}</tbody>
  </table>
  <p class="footer">
    Prices are in Philippine Peso (PHP). Subject to change without prior notice.<br />
    Contact ${escapeHtml(BRAND_NAME)} for orders and availability.
  </p>
  <p class="footer no-print">Use your browser&apos;s Print dialog and choose &quot;Save as PDF&quot; to download this list.</p>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

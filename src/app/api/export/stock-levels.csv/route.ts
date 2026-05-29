import { NextResponse } from "next/server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      costPrice: products.costPrice,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
      stockQuantity: products.stockQuantity,
      expiryDate: products.expiryDate,
    })
    .from(products)
    .where(eq(products.archived, false))
    .orderBy(asc(products.name));

  const header = [
    "product_id",
    "name",
    "brand",
    "variant",
    "stock_quantity",
    "cost_php",
    "retail_php",
    "bulk_php",
    "expiry_date",
  ];

  const lines = [header.join(",")].concat(
    rows.map((p) => {
      const expiry = p.expiryDate ? new Date(p.expiryDate).toISOString() : "";
      const cols = [
        p.id,
        JSON.stringify(p.name),
        JSON.stringify(p.brand),
        JSON.stringify(p.variant ?? ""),
        p.stockQuantity,
        (p.costPrice / 100).toFixed(2),
        (p.retailPrice / 100).toFixed(2),
        (p.bulkPrice / 100).toFixed(2),
        JSON.stringify(expiry),
      ];
      return cols.join(",");
    }),
  );

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="stock-levels.csv"`,
    },
  });
}


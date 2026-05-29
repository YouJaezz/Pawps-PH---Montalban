import { readFileSync } from "fs";

const { parsePdfBuffer } = await import("../src/lib/pdf-parse-server.ts");

async function testPdf(file, label) {
  const buf = readFileSync(file);
  const rows = await parsePdfBuffer(buf);

  const withType = rows.filter((row) => row.itemType);
  const withBrand = rows.filter((row) => row.brand);
  const withCost = rows.filter((row) => row.unitCostCents != null);

  console.log(`\n=== ${label} ===`);
  console.log(`Parsed rows: ${rows.length}`);
  console.log(`With brand: ${withBrand.length}, type: ${withType.length}, cost: ${withCost.length}`);
  console.log("Sample rows:");
  for (const row of rows.slice(0, 3)) {
    console.log(
      `  [${row.itemType ?? "?"}] ${row.brand ?? "?"} | ${row.variant ?? row.itemName} | ₱${(row.unitCostCents ?? 0) / 100}`,
    );
  }

  return rows.length;
}

const may = await testPdf(
  "c:/Users/xjaeq/Downloads/MAY-2026-NEW-PRICELIST-.pdf",
  "MAY",
);
const ws = await testPdf(
  "c:/Users/xjaeq/Downloads/WS-UPDATED-PRICELIST-2026.pdf",
  "WS",
);

console.log(`\nTotals: MAY=${may}, WS=${ws}`);

import { readFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const { PDFParse } = await import("pdf-parse");
const workerPath = path.join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.mjs",
);
PDFParse.setWorker(pathToFileURL(workerPath).href);

const { parseMayPriceListText } = await import("../src/lib/supplier-parse-pdf.ts");
const { parseWsPriceListText } = await import("../src/lib/supplier-parse-pdf-ws.ts");
const { detectPdfFormat } = await import("../src/lib/catalog-fields.ts");

async function testPdf(file, label) {
  const buf = readFileSync(file);
  const p = new PDFParse({ data: buf });
  const r = await p.getText();
  await p.destroy();

  const format = detectPdfFormat(r.text);
  const rows =
    format === "ws"
      ? parseWsPriceListText(r.text)
      : parseMayPriceListText(r.text);

  const withType = rows.filter((row) => row.itemType);
  const withBrand = rows.filter((row) => row.brand);
  const withCost = rows.filter((row) => row.unitCostCents != null);

  console.log(`\n=== ${label} (${format}) ===`);
  console.log(`Lines: ${r.text.split(/\r?\n/).filter(Boolean).length}`);
  console.log(`Parsed rows: ${rows.length}`);
  console.log(`With brand: ${withBrand.length}, type: ${withType.length}, cost: ${withCost.length}`);
  console.log("Sample rows:");
  for (const row of rows.slice(0, 5)) {
    console.log(
      `  [${row.itemType ?? "?"}] ${row.brand ?? "?"} | ${row.variant ?? row.itemName} | ${row.packSize ?? ""}${row.packUnit ?? ""} | ₱${(row.unitCostCents ?? 0) / 100}`,
    );
  }
  if (rows.length > 5) {
    console.log("  ...");
    for (const row of rows.slice(-3)) {
      console.log(
        `  [${row.itemType ?? "?"}] ${row.brand ?? "?"} | ${row.variant ?? row.itemName} | ${row.packSize ?? ""}${row.packUnit ?? ""} | ₱${(row.unitCostCents ?? 0) / 100}`,
      );
    }
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

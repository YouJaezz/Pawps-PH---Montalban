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

async function dump(file, label) {
  const buf = readFileSync(file);
  const p = new PDFParse({ data: buf });
  const r = await p.getText();
  await p.destroy();
  const lines = r.text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  console.log(`\n=== ${label} (${lines.length} lines, ${r.text.length} chars) ===\n`);
  console.log(lines.slice(0, 80).join("\n"));
  console.log("\n--- sample middle ---\n");
  console.log(lines.slice(200, 280).join("\n"));
  console.log("\n--- sample end ---\n");
  console.log(lines.slice(-40).join("\n"));
}

await dump("c:/Users/xjaeq/Downloads/MAY-2026-NEW-PRICELIST-.pdf", "MAY");
await dump("c:/Users/xjaeq/Downloads/WS-UPDATED-PRICELIST-2026.pdf", "WS");

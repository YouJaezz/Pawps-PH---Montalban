/**
 * PDF text extraction for Node/Vercel.
 * Import order matters: pdf-parse/worker must load before pdf-parse.
 */
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import type { ParsedCatalogRow } from "@/lib/catalog-fields";
import { detectPdfFormat } from "@/lib/catalog-fields";
import { configurePdfWorker } from "@/lib/pdf-worker";
import { parseMayPriceListText } from "@/lib/supplier-parse-pdf";
import { parseWsPriceListText } from "@/lib/supplier-parse-pdf-ws";

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedCatalogRow[]> {
  await configurePdfWorker(PDFParse);

  const parser = new PDFParse({ data: buffer, CanvasFactory });
  const result = await parser.getText();
  await parser.destroy();

  const format = detectPdfFormat(result.text);
  if (format === "ws") {
    return parseWsPriceListText(result.text);
  }
  return parseMayPriceListText(result.text);
}

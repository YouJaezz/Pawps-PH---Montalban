import { NextResponse } from "next/server";

import {
  AnthropicNotConfiguredError,
  isAnthropicApiConfigured,
  normalizePricelistWithClaude,
} from "@/lib/pricelist-normalize-ai";
import { requireAuth } from "@/lib/auth-guard";
import {
  applyCatalogKnowledgeToRows,
  buildCatalogKnowledge,
  looksLikeBadPricelistParse,
} from "@/lib/pricelist-catalog-knowledge";
import { parsePdfBuffer } from "@/lib/pdf-parse-server";
import {
  catalogRowsToPawps,
  isImageUpload,
  isPdfUpload,
  parsePricelistTextFree,
} from "@/lib/pricelist-normalize-free";
import { extractTextFromImages } from "@/lib/pricelist-normalize-ocr";
import type {
  NormalizeUploadFile,
  PawpsNormalizedRow,
} from "@/lib/pricelist-normalize-types";

export const maxDuration = 120;

type NormalizeRequestBody = {
  files?: NormalizeUploadFile[];
  pastedText?: string;
  supplierName?: string;
  extraInstructions?: string;
  preferAi?: boolean;
};

function decodeBase64(data: string) {
  return Buffer.from(data.replace(/^data:[^;]+;base64,/, ""), "base64");
}

async function parseFreeUploads(
  files: NormalizeUploadFile[],
  pastedText: string,
): Promise<PawpsNormalizedRow[]> {
  const rows: PawpsNormalizedRow[] = [];
  const seen = new Set<string>();

  function addRows(next: PawpsNormalizedRow[]) {
    for (const row of next) {
      const key = `${row.type}|${row.item}|${row.flavor ?? ""}|${row.size ?? ""}|${row.wholesale}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  if (pastedText.trim()) {
    addRows(parsePricelistTextFree(pastedText));
  }

  for (const file of files) {
    if (!isPdfUpload(file)) continue;
    try {
      const catalogRows = await parsePdfBuffer(decodeBase64(file.base64));
      addRows(catalogRowsToPawps(catalogRows));
    } catch {
      // skip unreadable PDFs; caller may fall back to AI
    }
  }

  const imageBuffers = files
    .filter(isImageUpload)
    .map((file) => decodeBase64(file.base64));

  if (imageBuffers.length > 0 && !pastedText.trim()) {
    try {
      const ocrText = await extractTextFromImages(imageBuffers);
      if (ocrText.trim()) {
        addRows(parsePricelistTextFree(ocrText));
      } else {
        console.error("Image OCR returned no text");
      }
    } catch (err) {
      console.error("Image OCR failed:", err);
    }
  }

  return rows;
}

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: NormalizeRequestBody;
  try {
    body = (await request.json()) as NormalizeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supplierName = body.supplierName?.trim() ?? "";
  if (!supplierName) {
    return NextResponse.json(
      { error: "Supplier name is required" },
      { status: 400 },
    );
  }

  const files = body.files ?? [];
  const pastedText = body.pastedText ?? "";
  const hasImages = files.some(isImageUpload);
  const hasPdf = files.some(isPdfUpload);
  const hasMessyUpload = hasImages || hasPdf;

  if (files.length === 0 && !pastedText.trim()) {
    return NextResponse.json(
      { error: "Upload at least one file or paste pricelist text" },
      { status: 400 },
    );
  }

  const totalBytes = files.reduce(
    (sum, f) => sum + Math.ceil((f.base64.length * 3) / 4),
    0,
  );
  if (totalBytes > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Total upload size exceeds 10 MB" },
      { status: 400 },
    );
  }

  const aiAvailable = isAnthropicApiConfigured();
  const preferAi = body.preferAi === true && aiAvailable;
  const knowledge = await buildCatalogKnowledge(supplierName);

  const finalize = (rows: PawpsNormalizedRow[]) =>
    applyCatalogKnowledgeToRows(rows, knowledge);

  try {
    if (!preferAi) {
      const freeRows = finalize(await parseFreeUploads(files, pastedText));
      const bad = looksLikeBadPricelistParse(freeRows);

      if (freeRows.length > 0 && (!bad || !aiAvailable || !hasMessyUpload)) {
        return NextResponse.json({
          rows: freeRows,
          method: "free",
          catalogMatched: knowledge.productCount,
        });
      }

      if (freeRows.length > 0 && bad && !aiAvailable) {
        return NextResponse.json({
          rows: freeRows,
          method: "free",
          catalogMatched: knowledge.productCount,
          warning:
            "Results may be incomplete. Add ANTHROPIC_API_KEY and use Smart scan for photos/PDFs.",
        });
      }
    }

    if (hasImages && !aiAvailable) {
      return NextResponse.json(
        {
          error:
            "Could not read product lines from the photo. Try a clearer screenshot, paste the pricelist text, upload a PDF, or add ANTHROPIC_API_KEY for Smart scan.",
          code: "FREE_PARSE_FAILED",
        },
        { status: 422 },
      );
    }

    if (!aiAvailable) {
      const freeRows = finalize(await parseFreeUploads(files, pastedText));
      if (freeRows.length > 0) {
        return NextResponse.json({
          rows: freeRows,
          method: "free",
          catalogMatched: knowledge.productCount,
        });
      }

      return NextResponse.json(
        {
          error:
            "No product lines found. Paste the full list with item names and prices (one per line), or use tab-separated columns from Google Sheets.",
          code: "FREE_PARSE_FAILED",
        },
        { status: 422 },
      );
    }

    const result = await normalizePricelistWithClaude({
      files,
      pastedText,
      supplierName,
      extraInstructions: body.extraInstructions ?? "",
      catalogContext: knowledge.promptBlock,
    });

    return NextResponse.json({
      rows: finalize(result.rows),
      method: "ai",
      catalogMatched: knowledge.productCount,
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      const freeRows = finalize(await parseFreeUploads(files, pastedText));
      if (freeRows.length > 0) {
        return NextResponse.json({
          rows: freeRows,
          method: "free",
          catalogMatched: knowledge.productCount,
        });
      }
      return NextResponse.json(
        {
          error:
            "No product lines found in pasted text. Include item names and wholesale prices.",
          code: "FREE_PARSE_FAILED",
        },
        { status: 422 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Normalization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

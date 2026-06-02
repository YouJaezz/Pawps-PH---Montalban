import path from "node:path";
import { createRequire } from "node:module";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createWorker, PSM } from "tesseract.js";

const require = createRequire(import.meta.url);

function getEngLangPath() {
  const pkgDir = path.dirname(
    require.resolve("@tesseract.js-data/eng/package.json"),
  );
  return path.join(pkgDir, "4.0.0");
}

export function cleanOcrText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[₱]/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/(\d)[,.](\d{3})\b/g, "$1$2")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

type CanvasCtx = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

function enhanceForOcr(ctx: CanvasCtx, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = Math.min(255, Math.max(0, (gray - 128) * 1.2 + 128));
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function renderSlice(
  image: Awaited<ReturnType<typeof loadImage>>,
  sx: number,
  sw: number,
  scale = 2,
) {
  const { height } = image;
  const outW = Math.max(1, Math.floor(sw * scale));
  const outH = Math.max(1, Math.floor(height * scale));
  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(image, sx, 0, sw, height, 0, 0, outW, outH);
  enhanceForOcr(ctx, outW, outH);
  return canvas.toBuffer("image/png");
}

function splitLines(text: string) {
  return cleanOcrText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function isHeaderLine(line: string) {
  return /^(?:PRICE|RICE|CATOOD|CATFCOD|CATFOOD|DOGFOOD|DOG\s*FOOD|CAT\s*FOOD|CAN)$/i.test(
    line,
  );
}

function extractPriceToken(line: string): number | null {
  const nums = [...line.matchAll(/\b(\d{2,4})\b/g)].map((m) => Number(m[1]));
  if (!nums.length) return null;
  const plausible = nums.filter((n) => n >= 15 && n <= 5000);
  return plausible[plausible.length - 1] ?? null;
}

function lineHasTrailingPrice(line: string) {
  const price = extractPriceToken(line);
  if (price == null) return false;
  return line.trim().endsWith(String(price));
}

function zipNamePriceLines(names: string[], prices: string[]) {
  const merged: string[] = [];
  const maxLen = Math.max(names.length, prices.length);

  for (let i = 0; i < maxLen; i++) {
    const name = names[i]?.trim() ?? "";
    const priceLine = prices[i]?.trim() ?? "";
    if (!name && !priceLine) continue;

    if (isHeaderLine(name) || (name && !priceLine && isHeaderLine(name))) {
      merged.push(name);
      continue;
    }

    if (lineHasTrailingPrice(name)) {
      merged.push(name);
      continue;
    }

    const price = extractPriceToken(priceLine) ?? extractPriceToken(name);
    if (name && price != null) merged.push(`${name} ${price}`);
    else if (name) merged.push(name);
    else if (priceLine) merged.push(priceLine);
  }

  return merged;
}

function combineColumnOcr(fullLines: string[], pairedLines: string[]) {
  const maxLen = Math.max(fullLines.length, pairedLines.length);
  const out: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const paired = pairedLines[i]?.trim() ?? "";
    const full = fullLines[i]?.trim() ?? "";

    if (lineHasTrailingPrice(paired)) {
      out.push(paired);
      continue;
    }
    if (lineHasTrailingPrice(full)) {
      out.push(full);
      continue;
    }

    const name = paired || full.replace(/\b\d{2,4}\s*$/g, "").trim();
    const price =
      extractPriceToken(paired) ??
      extractPriceToken(full) ??
      extractPriceToken(fullLines[i + 1] ?? "");

    if (name && price != null && !isHeaderLine(name)) out.push(`${name} ${price}`);
    else if (name) out.push(name);
    else if (full) out.push(full);
  }

  return out.join("\n");
}

async function ocrBuffer(
  worker: Awaited<ReturnType<typeof createWorker>>,
  buffer: Buffer,
  psm: PSM = PSM.SINGLE_COLUMN,
) {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const result = await worker.recognize(buffer);
  return result.data.text ?? "";
}

async function extractTextFromColumnHalf(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: Awaited<ReturnType<typeof loadImage>>,
  sx: number,
  sw: number,
) {
  const nameEnd = Math.floor(sw * 0.64);
  const priceStart = Math.floor(sw * 0.64);
  const priceWidth = sw - priceStart;

  const [fullBuf, nameBuf, priceBuf] = await Promise.all([
    renderSlice(image, sx, sw, 2),
    renderSlice(image, sx, nameEnd, 2),
    renderSlice(image, sx + priceStart, priceWidth, 2.2),
  ]);

  const [fullText, nameText, priceText] = await Promise.all([
    ocrBuffer(worker, fullBuf, PSM.SINGLE_COLUMN),
    ocrBuffer(worker, nameBuf, PSM.SINGLE_COLUMN),
    ocrBuffer(worker, priceBuf, PSM.SINGLE_BLOCK),
  ]);

  const paired = zipNamePriceLines(splitLines(nameText), splitLines(priceText));
  return combineColumnOcr(splitLines(fullText), paired);
}

async function splitImageIntoColumns(buffer: Buffer) {
  const image = await loadImage(buffer);
  const { width } = image;
  if (width < 400) return [{ image, sx: 0, sw: width }];

  const gap = Math.max(8, Math.floor(width * 0.015));
  const mid = Math.floor(width / 2);
  return [
    { image, sx: 0, sw: mid - gap },
    { image, sx: mid + gap, sw: width - mid - gap },
  ].filter(({ sw }) => sw >= 120);
}

export async function extractTextFromImages(buffers: Buffer[]) {
  if (buffers.length === 0) return "";

  const worker = await createWorker("eng", undefined, {
    langPath: getEngLangPath(),
    gzip: true,
    logger: () => {},
  });

  try {
    const chunks: string[] = [];
    for (const buffer of buffers) {
      const columns = await splitImageIntoColumns(buffer);
      for (const { image, sx, sw } of columns) {
        const lines = await extractTextFromColumnHalf(worker, image, sx, sw);
        if (lines) chunks.push(lines);
      }
    }
    return chunks.join("\n");
  } finally {
    await worker.terminate();
  }
}

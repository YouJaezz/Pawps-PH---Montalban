"use client";

import {
  cleanOcrText,
  combineColumnOcr,
  splitLines,
  zipNamePriceLines,
} from "@/lib/pricelist-normalize-ocr-shared";

type BrowserWorker = Awaited<ReturnType<typeof createBrowserWorker>>;

async function createBrowserWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng", undefined, { logger: () => {} });
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Could not load ${file.name}`));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function enhanceCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
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

async function renderSliceBlob(
  image: HTMLImageElement,
  sx: number,
  sw: number,
  scale = 2,
): Promise<Blob> {
  const outW = Math.max(1, Math.floor(sw * scale));
  const outH = Math.max(1, Math.floor(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(image, sx, 0, sw, image.height, 0, 0, outW, outH);
  enhanceCanvas(ctx, outW, outH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not render image slice");
  return blob;
}

async function ocrBlob(
  worker: BrowserWorker,
  blob: Blob,
  psm: import("tesseract.js").PSM,
) {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const result = await worker.recognize(blob);
  return result.data.text ?? "";
}

async function extractTextFromColumnHalf(
  worker: BrowserWorker,
  image: HTMLImageElement,
  sx: number,
  sw: number,
) {
  const nameEnd = Math.floor(sw * 0.64);
  const priceStart = Math.floor(sw * 0.64);
  const priceWidth = sw - priceStart;

  const [fullBuf, nameBuf, priceBuf] = await Promise.all([
    renderSliceBlob(image, sx, sw, 2),
    renderSliceBlob(image, sx, nameEnd, 2),
    renderSliceBlob(image, sx + priceStart, priceWidth, 2.2),
  ]);

  const { PSM } = await import("tesseract.js");
  const [fullText, nameText, priceText] = await Promise.all([
    ocrBlob(worker, fullBuf, PSM.SINGLE_COLUMN),
    ocrBlob(worker, nameBuf, PSM.SINGLE_COLUMN),
    ocrBlob(worker, priceBuf, PSM.SINGLE_BLOCK),
  ]);

  const paired = zipNamePriceLines(splitLines(nameText), splitLines(priceText));
  return combineColumnOcr(splitLines(fullText), paired);
}

function columnSlices(image: HTMLImageElement) {
  const { width } = image;
  if (width < 400) return [{ sx: 0, sw: width }];

  const gap = Math.max(8, Math.floor(width * 0.015));
  const mid = Math.floor(width / 2);
  return [
    { sx: 0, sw: mid - gap },
    { sx: mid + gap, sw: width - mid - gap },
  ].filter(({ sw }) => sw >= 120);
}

/** Free-mode OCR in the browser — avoids Vercel serverless limits. */
export async function extractTextFromImageFiles(files: File[]) {
  if (files.length === 0) return "";

  const worker = await createBrowserWorker();
  try {
    const chunks: string[] = [];
    for (const file of files) {
      try {
        const image = await loadImageFromFile(file);
        const slices = columnSlices(image);
        for (const { sx, sw } of slices) {
          const text = await extractTextFromColumnHalf(worker, image, sx, sw);
          if (text) chunks.push(text);
        }
      } catch {
        const result = await worker.recognize(file);
        const text = cleanOcrText(result.data.text ?? "");
        if (text) chunks.push(text);
      }
    }
    return chunks.join("\n");
  } finally {
    await worker.terminate();
  }
}

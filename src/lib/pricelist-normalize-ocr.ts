import path from "node:path";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { createWorker, PSM } from "tesseract.js";
import {
  cleanOcrText,
  combineColumnOcr,
  splitLines,
  zipNamePriceLines,
} from "@/lib/pricelist-normalize-ocr-shared";

export { cleanOcrText } from "@/lib/pricelist-normalize-ocr-shared";

function getTesseractOptions() {
  const cachePath = process.env.VERCEL ? "/tmp" : tmpdir();
  const bundledTrain = path.join(process.cwd(), "eng.traineddata");
  if (existsSync(bundledTrain)) {
    return {
      langPath: process.cwd(),
      gzip: false,
      cachePath,
    };
  }

  return {
    langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0",
    gzip: true,
    cachePath,
  };
}

async function loadCanvas() {
  return import("@napi-rs/canvas");
}

async function renderSlice(
  canvasMod: Awaited<ReturnType<typeof loadCanvas>>,
  image: Awaited<ReturnType<(typeof canvasMod)["loadImage"]>>,
  sx: number,
  sw: number,
  scale = 2,
) {
  const { createCanvas } = canvasMod;
  const { height } = image;
  const outW = Math.max(1, Math.floor(sw * scale));
  const outH = Math.max(1, Math.floor(height * scale));
  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(image, sx, 0, sw, height, 0, 0, outW, outH);

  const imageData = ctx.getImageData(0, 0, outW, outH);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    const v = Math.min(255, Math.max(0, (gray - 128) * 1.2 + 128));
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer("image/png");
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
  canvasMod: Awaited<ReturnType<typeof loadCanvas>>,
  image: Awaited<ReturnType<(typeof canvasMod)["loadImage"]>>,
  sx: number,
  sw: number,
) {
  const nameEnd = Math.floor(sw * 0.64);
  const priceStart = Math.floor(sw * 0.64);
  const priceWidth = sw - priceStart;

  const [fullBuf, nameBuf, priceBuf] = await Promise.all([
    renderSlice(canvasMod, image, sx, sw, 2),
    renderSlice(canvasMod, image, sx, nameEnd, 2),
    renderSlice(canvasMod, image, sx + priceStart, priceWidth, 2.2),
  ]);

  const [fullText, nameText, priceText] = await Promise.all([
    ocrBuffer(worker, fullBuf, PSM.SINGLE_COLUMN),
    ocrBuffer(worker, nameBuf, PSM.SINGLE_COLUMN),
    ocrBuffer(worker, priceBuf, PSM.SINGLE_BLOCK),
  ]);

  const paired = zipNamePriceLines(splitLines(nameText), splitLines(priceText));
  return combineColumnOcr(splitLines(fullText), paired);
}

async function splitImageIntoColumns(
  canvasMod: Awaited<ReturnType<typeof loadCanvas>>,
  buffer: Buffer,
) {
  const image = await canvasMod.loadImage(buffer);
  const { width } = image;
  if (width < 400) return [{ image, sx: 0, sw: width }];

  const gap = Math.max(8, Math.floor(width * 0.015));
  const mid = Math.floor(width / 2);
  return [
    { image, sx: 0, sw: mid - gap },
    { image, sx: mid + gap, sw: width - mid - gap },
  ].filter(({ sw }) => sw >= 120);
}

async function extractTextDirect(
  worker: Awaited<ReturnType<typeof createWorker>>,
  buffers: Buffer[],
) {
  const chunks: string[] = [];
  for (const buffer of buffers) {
    const result = await worker.recognize(buffer);
    const text = cleanOcrText(result.data.text ?? "");
    if (text) chunks.push(text);
  }
  return chunks.join("\n");
}

async function extractTextWithColumnPipeline(
  worker: Awaited<ReturnType<typeof createWorker>>,
  buffers: Buffer[],
) {
  const canvasMod = await loadCanvas();
  const chunks: string[] = [];
  for (const buffer of buffers) {
    const columns = await splitImageIntoColumns(canvasMod, buffer);
    for (const { image, sx, sw } of columns) {
      const lines = await extractTextFromColumnHalf(worker, canvasMod, image, sx, sw);
      if (lines) chunks.push(lines);
    }
  }
  return chunks.join("\n");
}

export async function extractTextFromImages(buffers: Buffer[]) {
  if (buffers.length === 0) return "";

  const worker = await createWorker("eng", undefined, {
    ...getTesseractOptions(),
    logger: () => {},
  });

  try {
    try {
      return await extractTextWithColumnPipeline(worker, buffers);
    } catch (err) {
      console.error(
        "Column OCR preprocessing failed, falling back to direct OCR:",
        err,
      );
      return await extractTextDirect(worker, buffers);
    }
  } finally {
    await worker.terminate();
  }
}

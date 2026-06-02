import path from "node:path";
import { createRequire } from "node:module";
import { createWorker } from "tesseract.js";

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
      const result = await worker.recognize(buffer);
      const text = cleanOcrText(result.data.text ?? "");
      if (text) chunks.push(text);
    }
    return chunks.join("\n");
  } finally {
    await worker.terminate();
  }
}

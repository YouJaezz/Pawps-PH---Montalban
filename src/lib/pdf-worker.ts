import path from "path";
import { pathToFileURL } from "url";

/** Resolve pdf.js worker for serverless (Vercel) and local dev. */
export function resolvePdfWorkerUrl(): string {
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs",
  );

  try {
    return pathToFileURL(workerPath).href;
  } catch {
    return "https://unpkg.com/pdfjs-dist@5.4.296/legacy/build/pdf.worker.mjs";
  }
}

export async function configurePdfWorker(PDFParse: {
  setWorker: (workerSrc?: string) => string;
}) {
  PDFParse.setWorker(resolvePdfWorkerUrl());
}

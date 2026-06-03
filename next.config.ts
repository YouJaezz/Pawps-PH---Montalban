import type { NextConfig } from "next";

const productionSiteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ?? productionSiteUrl ?? "http://localhost:3000",
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "tesseract.js"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/suppliers/normalize": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./eng.traineddata",
    ],
    "/api/export/daily-sales.csv": ["./node_modules/pdf-parse/**/*"],
    "/api/export/stock-levels.csv": ["./node_modules/pdf-parse/**/*"],
  },
};

export default nextConfig;

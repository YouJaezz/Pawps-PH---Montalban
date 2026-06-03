import {
  PAWPS_CATALOG_TYPES,
  type NormalizeUploadFile,
  type PawpsNormalizeAiResponse,
  type PawpsNormalizedRow,
} from "@/lib/pricelist-normalize-types";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8000;

export function isAnthropicApiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export class AnthropicNotConfiguredError extends Error {
  code = "ANTHROPIC_NOT_CONFIGURED" as const;

  constructor() {
    super("ANTHROPIC_API_KEY is not configured");
    this.name = "AnthropicNotConfiguredError";
  }
}

const SYSTEM_PROMPT = `You extract pet supply pricelist data and normalize it into Pawps PH catalog rows.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "rows": [
    {
      "type": "Dog Dry Food",
      "item": "Aozi",
      "flavor": "Gold Adult",
      "size": "20kg",
      "per_kg": 158,
      "wholesale": 2975,
      "retail": 3010
    }
  ]
}

Field rules:
- type: exactly one of: ${PAWPS_CATALOG_TYPES.map((t) => `"${t}"`).join(" | ")}
- item: brand name only (e.g. Aozi, Pedigree, Whiskas) — no variant in item
- flavor: variant/flavor/sub-type only; null if none
- size: weight or volume like 20kg, 400g, 10L; null if not given
- per_kg: price per kg as a number; null if not listed
- wholesale: wholesale/dealer/WS price as a number — REQUIRED for every product row
- retail: retail/SRP price as a number; null if not listed

Include every product line you can identify. Never omit a row because wholesale is missing — estimate from context only if truly unavoidable, prefer extracting the listed WS/dealer price.
Prices are Philippine peso amounts as plain numbers (no currency symbols).
If pasted text or tables use headers, map columns intelligently.`;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    }
  | {
      type: "document";
      source: { type: "base64"; media_type: string; data: string };
    };

function mimeForFile(name: string, mimeType: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return mimeType || "application/octet-stream";
}

function buildUserContent(
  files: NormalizeUploadFile[],
  pastedText: string,
  supplierName: string,
  extraInstructions: string,
): AnthropicContentBlock[] {
  const blocks: AnthropicContentBlock[] = [];

  for (const file of files) {
    const media = mimeForFile(file.name, file.mimeType);
    const data = file.base64.replace(/^data:[^;]+;base64,/, "");
    if (media === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: media, data },
      });
    } else if (media.startsWith("image/")) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: media, data },
      });
    }
  }

  const textParts: string[] = [
    `Supplier name for this pricelist: ${supplierName}`,
  ];
  if (extraInstructions.trim()) {
    textParts.push(`Extra instructions: ${extraInstructions.trim()}`);
  }
  if (pastedText.trim()) {
    textParts.push("Pasted pricelist text / sheet data:\n" + pastedText.trim());
  }
  if (files.length > 0) {
    textParts.push(
      `Attached ${files.length} file(s): ${files.map((f) => f.name).join(", ")}. Extract all products from every attachment.`,
    );
  }

  blocks.push({ type: "text", text: textParts.join("\n\n") });
  return blocks;
}

export function stripJsonFences(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i;
  const m = s.match(fence);
  if (m) s = m[1].trim();
  return s;
}

function coerceNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function coerceRow(raw: Record<string, unknown>): PawpsNormalizedRow | null {
  const item = String(raw.item ?? "").trim();
  const wholesale = coerceNumber(raw.wholesale);
  if (!item || wholesale == null) return null;

  const flavorRaw = raw.flavor;
  const sizeRaw = raw.size;
  const flavor =
    flavorRaw == null || flavorRaw === ""
      ? null
      : String(flavorRaw).trim() || null;
  const size =
    sizeRaw == null || sizeRaw === ""
      ? null
      : String(sizeRaw).trim() || null;

  return {
    type: String(raw.type ?? "Other").trim() || "Other",
    item,
    flavor,
    size,
    per_kg: coerceNumber(raw.per_kg),
    wholesale,
    retail: coerceNumber(raw.retail),
  };
}

export function parseAiJson(text: string): PawpsNormalizeAiResponse {
  const cleaned = stripJsonFences(text);
  const parsed = JSON.parse(cleaned) as { rows?: unknown };
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error("AI response missing rows array");
  }
  const rows: PawpsNormalizedRow[] = [];
  for (const entry of parsed.rows) {
    if (!entry || typeof entry !== "object") continue;
    const row = coerceRow(entry as Record<string, unknown>);
    if (row) rows.push(row);
  }
  if (rows.length === 0) {
    throw new Error("No valid product rows in AI response");
  }
  return { rows };
}

export async function normalizePricelistWithClaude(params: {
  files: NormalizeUploadFile[];
  pastedText: string;
  supplierName: string;
  extraInstructions: string;
  catalogContext?: string;
}): Promise<PawpsNormalizeAiResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new AnthropicNotConfiguredError();
  }

  if (
    params.files.length === 0 &&
    !params.pastedText.trim()
  ) {
    throw new Error("Provide at least one file or pasted text");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: params.catalogContext
        ? `${SYSTEM_PROMPT}\n\n${params.catalogContext}`
        : SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserContent(
            params.files,
            params.pastedText,
            params.supplierName,
            params.extraInstructions,
          ),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Claude API error (${res.status}): ${errText.slice(0, 500)}`,
    );
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlock = data.content?.find((c) => c.type === "text");
  const text = textBlock?.text;
  if (!text) {
    throw new Error("Empty response from Claude");
  }

  return parseAiJson(text);
}

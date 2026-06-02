import type { ParsedCatalogRow } from "@/lib/catalog-fields";
import { buildCatalogRow, extractBrand } from "@/lib/catalog-fields";

const SKIP_LINE =
  /^(?:PRICE|RICE|CATOOD|CATFOOD|DOGFOOD|DOG\s*FOOD|CAT\s*FOOD|CAN)$/i;

const SECTION_DOG = /^DOG\s*FOOD|^DOGFOOD\b/i;
const SECTION_CAT = /^CAT\s*FOOD|^CATFOOD\b|^CATOOD\b/i;
const SECTION_CAN = /^CAN\b/i;

const SIZE_SUFFIX =
  /(\d+(?:\.\d+)?)\s*(KG|G|L|ML|kg|g|l|ml)\s*$/i;

const SIZE_SUFFIX_LOOSE =
  /\b(\d+(?:\.\d+)?)\s*K(?!G|\w)\b|\b(\d+(?:\.\d+)?)\s*K:$/i;

const OCR_PREFIX_FIXES: Array<[RegExp, string]> = [
  [/^CIAL CAT\b/i, "SPECIAL CAT"],
  [/^SKAS\b/i, "WHISKAS"],
  [/^1 CAT\b/i, "AOZI CAT"],
  [/^CAT TUNAS/i, "AOZI CAT TUNA &"],
  [/^CAT TUNA &CHICKEN/i, "AOZI CAT TUNA & CHICKEN"],
  [/^CAT TUNA & BEEF/i, "AOZI CAT TUNA & BEEF"],
  [/^CAT SALMON & CHICKEN/i, "AOZI CAT SALMON & CHICKEN"],
  [/^CAT SALMON & BEEF/i, "AOZI CAT SALMON & BEEF"],
  [/^CAT SALMON\b/i, "AOZI CAT SALMON"],
  [/^CAT OCEAN FISH/i, "AOZI CAT OCEAN FISH"],
  [/^CAT CHICKEN\b/i, "AOZI CAT CHICKEN"],
  [/^CAT BEEF\b/i, "AOZI CAT BEEF"],
  [/^CAT TUNA\b/i, "AOZI CAT TUNA"],
  [/^VER CAT\b/i, "POWER CAT"],
  [/^ER CAT\b/i, "POWER CAT"],
  [/^JER CAT\b/i, "POWER CAT"],
  [/^\/ER CAT\b/i, "POWER CAT"],
  [/^POWER CATTUNA/i, "POWER CAT TUNA"],
  [/^POWERCAT\b/i, "POWER CAT"],
  [/^INUTRICARE/i, "NUTRICARE"],
  [/^NOTRICARE/i, "NUTRICARE"],
  [/^hes SEAFOOD/i, "ME-O SEAFOOD"],
  [/^ONE CUISINE IMPORTED/i, "PET ONE CUISINE IMPORTED"],
  [/^CARE CAT FOOD/i, "CATCARE CAT FOOD"],
  [/^KITTEN 20KG$/i, "APRO KITTEN 20KG"],
  [/^CATFOOD 20KG$/i, "ZOI CATFOOD 20KG"],
  [/\bTKG\b/gi, "7KG"],
  [/\bBKG\b/gi, "8KG"],
  [/\bZ0KG\b/gi, "20KG"],
  [/\b15K\(q\b/gi, "15KG"],
  [/\bFISH20KG\b/gi, "FISH 20KG"],
  [/\bSEAFOOD15KG\b/gi, "SEAFOOD 15KG"],
  [/\bBEEFSLIVER\b/gi, "BEEF & LIVER"],
  [/\bRABBITSLIVER\b/gi, "RABBIT & LIVER"],
  [/\bHEART SLIVER\b/gi, "HEART & LIVER"],
  [/\bTUNA&OCEAN\b/gi, "TUNA & OCEAN"],
  [/^AQZ!/i, "AOZI"],
  [/^AQZI\b/i, "AOZI"],
  [/^TOE!\b/i, "TOEI"],
  [/^20!\b/i, "ZOI"],
  [/^i AISTIC/i, "HOLISTIC"],
  [/^HOLISTIC RECIFE/i, "HOLISTIC RECIPE"],
  [/^SUAPODOG/i, "GUAPODOG"],
  [/^VITALAME/i, "VITALAMB"],
  [/^O KITTEN/i, "APRO KITTEN"],
  [/^DIXIE CATFOQD/i, "DIXIE CATFOOD"],
  [/^SMARTHEART CHICKEN &TUl/i, "SMARTHEART CHICKEN & TUNA"],
  [/^SMARTHEART SEAFOOD 15K\(/i, "SMARTHEART SEAFOOD 15KG"],
  [/^POWER CAT OCEAN FISH 8K\(/i, "POWER CAT OCEAN FISH 8KG"],
  [/^LUCY CAT 20%/i, "LUCY CAT 30%"],
];

function isPlausiblePrice(
  n: number,
  packUnit?: string,
  inCanSection?: boolean,
  packSize?: string,
) {
  if (!Number.isFinite(n)) return false;
  const ps = packSize ? Number(packSize) : NaN;

  if (packUnit === "g" || packUnit === "ml" || inCanSection) {
    if (ps >= 400 && n > 150) return n >= 150 && n <= 500;
    return n >= 10 && n <= 500;
  }

  if (Number.isFinite(ps) && ps >= 7 && n < 400) return false;
  if (Number.isFinite(ps) && ps >= 15 && n < 700) return false;
  return n >= 50 && n <= 5000;
}

function scorePrice(
  n: number,
  packUnit?: string,
  inCanSection?: boolean,
  packSize?: string,
) {
  if (!isPlausiblePrice(n, packUnit, inCanSection, packSize)) return -1;
  const ps = packSize ? Number(packSize) : NaN;

  if (packUnit === "g" || packUnit === "ml" || inCanSection) {
    if (n >= 15 && n <= 250) return 3;
    return 2;
  }

  if (Number.isFinite(ps) && ps >= 15 && n >= 900 && n <= 3500) return 3;
  if (Number.isFinite(ps) && ps >= 7 && n >= 500 && n <= 3500) return 3;
  if (n >= 500 && n <= 4000) return 2;
  return 1;
}

function cleanLine(raw: string) {
  let line = raw
    .replace(/[[\]|#_\\]/g, " ")
    .replace(/[^\w\s./&%-]/g, " ")
    .replace(/(\D)(\d+(?:\.\d+)?)(KG|G|ML|L)\b/gi, "$1 $2$3")
    .replace(/(\d+(?:\.\d+)?)(KG|G|ML|L)\b/gi, "$1 $2")
    .replace(/\b(\d+(?:\.\d+)?)\s*K\b(?!\G)/gi, "$1KG")
    .replace(/\bZ0K\b/gi, "20KG")
    .replace(/\b20xG\b/gi, "20KG")
    .replace(/\b204G\b/gi, "20KG")
    .replace(/\b22\s*72k\b/gi, "22.72KG")
    .replace(/\b22\s*721G\b/gi, "22.72KG")
    .replace(/\b22\s*7TKG\b/gi, "22.7KG")
    .replace(/\b15\+\b/g, "15KG")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of OCR_PREFIX_FIXES) {
    line = line.replace(pattern, replacement);
  }

  return line;
}

function inferAnimal(desc: string, fallback: "dog" | "cat"): "dog" | "cat" {
  const u = desc.toUpperCase();
  if (
    /\b(DOG|PEDIGREE|TOP BREED|BEEF PRO|GOODBOY|GOOD BOY|WHOOPY|YUMYUM|ZOI DOG|GUAPODOG|DERBY|VALUEMEAL|VITABEEF|VITALAMB|CANIS PRIME|NUTRICHUNKS|OPTIMA|HOLISTIC|LAMB CLASSIC|TOEI DOG|SPECIAL DOG|BOWOW|PET ONE DOG|APRO KITTEN 20KG)\b/.test(
      u,
    ) &&
    !/\bCAT\b/.test(u)
  ) {
    return "dog";
  }
  if (
    /\b(CAT|WHISKAS|KITEKAT|FELIX|AOZI CAT|SPECIAL CAT|SMARTHEART|CUTIES|ME-O|PRINCESS|POWER CAT|INFINITY|NUTRICARE|MININO|LUCY CAT|DIXIE|HEARTY|LIFE CAT|MONELLO|TOEI CAT|ZOI CAT|APRO|GOODEST)\b/.test(
      u,
    )
  ) {
    return "cat";
  }
  return fallback;
}

function isCanLine(desc: string, inCanSection: boolean, packUnit?: string) {
  if (inCanSection) return true;
  const u = desc.toUpperCase();
  if (packUnit === "g" || packUnit === "ml") return true;
  return /\b(CAN|POUCH|POUCHES)\b/.test(u);
}

function resolvePawpsItemType(
  animal: "dog" | "cat",
  inCanSection: boolean,
  desc: string,
  packUnit?: string,
): string {
  const isSmall = isCanLine(desc, inCanSection, packUnit);
  const upper = desc.toUpperCase();

  if (animal === "dog") {
    if (isSmall) {
      return /\bPOUCH\b/.test(upper)
        ? "Dog Wet Food Pouch"
        : "Dog Canned Food";
    }
    return "Dog Food";
  }

  if (isSmall) {
    return /\bPOUCH\b/.test(upper) ? "Cat Wet Food Pouch" : "Cat Canned Food";
  }
  return "Cat Food";
}

function stripNoiseNumbers(desc: string) {
  return desc
    .replace(/\b\d{1,2}\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTrailingPrice(
  line: string,
  packUnit?: string,
  inCanSection?: boolean,
  packSize?: string,
): { desc: string; price: number } | null {
  const numbers = [...line.matchAll(/\b(\d{2,4})\b/g)].map((m) => Number(m[1]));
  const scored = numbers
    .map((n) => ({
      n,
      score: scorePrice(n, packUnit, inCanSection, packSize),
    }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || b.n - a.n);

  if (scored.length === 0) return null;

  const price = scored[0]!.n;
  const idx = line.lastIndexOf(String(price));
  let desc = stripNoiseNumbers(line.slice(0, idx).trim());

  const innerPrices = [...desc.matchAll(/\b(\d{3,4})\b/g)].map((m) =>
    Number(m[1]),
  );
  if (innerPrices.length > 0) {
    desc = desc.replace(/\b\d{3,4}\b/g, " ").replace(/\s+/g, " ").trim();
  }

  if (desc.length < 3) return null;
  return { desc, price };
}

function parseSimpleLine(
  rawLine: string,
  defaultAnimal: "dog" | "cat",
  inCanSection: boolean,
): ParsedCatalogRow | null {
  const line = cleanLine(rawLine);
  if (line.length < 4 || SKIP_LINE.test(line)) return null;
  if (/^(?:PRICE|RICE)$/i.test(line)) return null;
  if (/^[A-Z]{1,2}$/.test(line)) return null;

  let packSize: string | undefined;
  let packUnit: string | undefined;
  let desc = line;
  const sizeMatch = desc.match(SIZE_SUFFIX);
  if (sizeMatch) {
    packSize = sizeMatch[1];
    packUnit = sizeMatch[2]!.toLowerCase();
    if (packUnit === "l") packUnit = "L";
    desc = desc.slice(0, desc.length - sizeMatch[0].length).trim();
  } else {
    const loose = desc.match(SIZE_SUFFIX_LOOSE);
    if (loose) {
      packSize = loose[1] ?? loose[2];
      packUnit = "kg";
      desc = desc.replace(loose[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  const priced = extractTrailingPrice(desc, packUnit, inCanSection, packSize);
  if (!priced) return null;

  desc = priced.desc;
  const price = priced.price;
  if (desc.split(/\s+/).length < 1) return null;

  const animal = inferAnimal(desc, defaultAnimal);
  const { brand, variant } = extractBrand(desc);
  const itemType = resolvePawpsItemType(
    animal,
    inCanSection || isCanLine(desc, false, packUnit),
    desc,
    packUnit,
  );

  return buildCatalogRow({
    brand,
    variant,
    itemType,
    packSize,
    packUnit,
    unitCostCents: price * 100,
  });
}

/** Two-column supplier sheets: DOGFOOD/CATFOOD + PRICE, product lines with trailing price. */
export function parseSimpleColumnPriceListText(text: string): ParsedCatalogRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const rows: ParsedCatalogRow[] = [];
  let animal: "dog" | "cat" = "cat";
  let inCanSection = false;

  if (/DOG\s*FOOD|DOGFOOD/i.test(text) && !/CAT\s*FOOD|CATFOOD/i.test(text)) {
    animal = "dog";
  }

  for (const line of lines) {
    if (SECTION_DOG.test(line)) {
      animal = "dog";
      inCanSection = false;
      continue;
    }
    if (SECTION_CAT.test(line)) {
      animal = "cat";
      inCanSection = false;
      continue;
    }
    if (SECTION_CAN.test(line)) {
      inCanSection = true;
      continue;
    }
    if (/^PRICE$|^RICE$/i.test(line)) continue;

    const row = parseSimpleLine(line, animal, inCanSection);
    if (row) rows.push(row);
  }

  return rows;
}

export function looksLikeSimpleColumnPriceList(text: string) {
  const sample = text.slice(0, 8000);
  if (/(?:DOG\s*FOOD|CAT\s*FOOD|DOGFOOD|CATFOOD)/i.test(sample)) return true;

  const brandHits =
    (sample.match(
      /\b(?:AOZI|WHISKAS|PEDIGREE|SMARTHEART|SPECIAL CAT|TOP BREED|CUTIES|ME-O|POWER CAT|NUTRICARE|INFINITY)\b/gi,
    )?.length ?? 0) >= 3;
  const priceLines = sample.match(/\b\d{2,4}\s*$/gm)?.length ?? 0;

  return brandHits && priceLines >= 5;
}

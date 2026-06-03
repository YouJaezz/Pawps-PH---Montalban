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

export function splitLines(text: string) {
  return cleanOcrText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function isHeaderLine(line: string) {
  return /^(?:PRICE|RICE|CATOOD|CATFCOD|CATFOOD|DOGFOOD|DOG\s*FOOD|CAT\s*FOOD|CAN)$/i.test(
    line,
  );
}

export function extractPriceToken(line: string): number | null {
  const nums = [...line.matchAll(/\b(\d{2,4})\b/g)].map((m) => Number(m[1]));
  if (!nums.length) return null;
  const plausible = nums.filter((n) => n >= 15 && n <= 5000);
  return plausible[plausible.length - 1] ?? null;
}

export function lineHasTrailingPrice(line: string) {
  const price = extractPriceToken(line);
  if (price == null) return false;
  return line.trim().endsWith(String(price));
}

export function zipNamePriceLines(names: string[], prices: string[]) {
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

export function combineColumnOcr(fullLines: string[], pairedLines: string[]) {
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

"use server";

import { requireAdmin } from "@/lib/auth-guard";
import { parseMoneyToCents } from "@/lib/money";
import { revalidateSalesPages } from "@/lib/revalidate-sales";
import { getSession } from "@/lib/session";
import { insertBranchRemittance } from "@/db/queries/branch-remittances";

export type BranchRemitActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function ok(message: string): BranchRemitActionResult {
  return { ok: true, message };
}

function err(message: string): BranchRemitActionResult {
  return { error: message };
}

function parseIntStrict(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export async function recordBranchRemittance(
  _prev: BranchRemitActionResult,
  formData: FormData,
): Promise<BranchRemitActionResult> {
  await requireAdmin();
  const session = await getSession();

  const branchId = parseIntStrict(formData.get("branchId"));
  if (!branchId || branchId <= 0) return err("Invalid branch.");

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountCents = parseMoneyToCents(amountRaw);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return err("Enter a valid remittance amount.");
  }

  const dateRaw = String(formData.get("remittedAt") ?? "").trim();
  const remittedAt = dateRaw ? new Date(`${dateRaw}T00:00:00.000+08:00`) : new Date();

  const note = String(formData.get("note") ?? "").trim() || null;

  await insertBranchRemittance({
    branchId,
    amountCents,
    remittedAt,
    note,
    recordedByUserId: session?.userId ?? null,
  });

  revalidateSalesPages();
  return ok("Remittance recorded.");
}


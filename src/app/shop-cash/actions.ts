"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { getInvestorCapitalDashboard } from "@/db/queries/investor-capital";
import {
  investorCapitalLedger,
  products,
  shopCashOutflows,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { adjustBranchStock, getDefaultBranchId } from "@/lib/branch-stock";
import { parseMoneyToCents } from "@/lib/money";
import { parsePhDateInput } from "@/lib/payroll-payment";
import { applyRestockUnitCostUpdate } from "@/lib/restock-cost-update";
import { getSession } from "@/lib/session";
import {
  normalizeExpenseCategory,
  normalizeFundingSource,
} from "@/lib/shop-cash";
import { tryAutoFulfillPreOrdersForProduct } from "@/lib/preorder-fulfillment";

export type ShopCashActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidateShopCash() {
  revalidatePath("/shop-cash");
  revalidatePath("/reports");
  revalidatePath("/");
  revalidatePath("/suppliers");
  revalidatePath("/products");
}

function parsePaidAt(formData: FormData) {
  const raw = String(formData.get("paidAt") ?? "").trim();
  const parsed = parsePhDateInput(raw);
  if (!parsed) {
    throw new Error("Enter a valid payment date.");
  }
  return parsed;
}

async function assertInvestorCapitalAvailable(amountCents: number) {
  const { balanceCents } = await getInvestorCapitalDashboard();
  if (amountCents > balanceCents) {
    throw new Error(
      `Not enough investor capital (available ${(balanceCents / 100).toFixed(2)} ₱). Record a contribution first.`,
    );
  }
}

export async function recordInvestorContribution(
  _prev: ShopCashActionResult | null,
  formData: FormData,
): Promise<ShopCashActionResult> {
  await requireAdmin();
  const session = await getSession();

  const amountCents = parseMoneyToCents(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const investorIdRaw = Number.parseInt(String(formData.get("investorId") ?? ""), 10);
  const investorId =
    Number.isFinite(investorIdRaw) && investorIdRaw > 0 ? investorIdRaw : null;

  if (amountCents <= 0) {
    return { error: "Enter the contribution amount." };
  }
  if (!description) {
    return { error: "Description is required (e.g. March capital top-up)." };
  }

  let contributedAt: Date;
  try {
    contributedAt = parsePaidAt(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid date." };
  }

  await db.insert(investorCapitalLedger).values({
    amountCents,
    description,
    contributedAt,
    investorId,
    notes,
    recordedByUserId: session?.userId ?? null,
  });

  revalidateShopCash();
  revalidatePath("/investors");
  return { ok: true, message: "Investor contribution recorded." };
}

export async function recordShopExpense(
  _prev: ShopCashActionResult | null,
  formData: FormData,
): Promise<ShopCashActionResult> {
  await requireAdmin();
  const session = await getSession();

  const amountCents = parseMoneyToCents(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const expenseCategory = normalizeExpenseCategory(
    String(formData.get("expenseCategory") ?? ""),
  );
  const fundingSource = normalizeFundingSource(
    String(formData.get("fundingSource") ?? ""),
  );

  if (amountCents <= 0) {
    return { error: "Enter the amount paid." };
  }
  if (!description) {
    return { error: "Description is required (e.g. Meralco bill — March)." };
  }

  let paidAt: Date;
  try {
    paidAt = parsePaidAt(formData);
    if (fundingSource === "investor_capital") {
      await assertInvestorCapitalAvailable(amountCents);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid date." };
  }

  await db.insert(shopCashOutflows).values({
    kind: "expense",
    fundingSource,
    expenseCategory,
    amountCents,
    description,
    vendor,
    reference,
    paidAt,
    notes,
    recordedByUserId: session?.userId ?? null,
  });

  revalidateShopCash();
  const sourceLabel =
    fundingSource === "investor_capital" ? "investor capital" : "shop cash";
  return { ok: true, message: `Expense recorded — paid from ${sourceLabel}.` };
}

export async function recordShopRestock(
  _prev: ShopCashActionResult | null,
  formData: FormData,
): Promise<ShopCashActionResult> {
  await requireAdmin();
  const session = await getSession();

  const amountCents = parseMoneyToCents(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const addStock = formData.get("addStock") === "on";
  const fundingSource = normalizeFundingSource(
    String(formData.get("fundingSource") ?? ""),
  );

  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  const branchIdRaw = Number.parseInt(String(formData.get("branchId") ?? ""), 10);
  const supplierIdRaw = Number.parseInt(String(formData.get("supplierId") ?? ""), 10);
  const stockQty = Number.parseInt(String(formData.get("stockQty") ?? ""), 10);

  if (amountCents <= 0) {
    return { error: "Enter how much you paid." };
  }

  let paidAt: Date;
  try {
    paidAt = parsePaidAt(formData);
    if (fundingSource === "investor_capital") {
      await assertInvestorCapitalAvailable(amountCents);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid date." };
  }

  let resolvedProductId: number | null = null;
  let resolvedBranchId: number | null = null;
  let resolvedSupplierId: number | null = null;
  let stockQtyAdded: number | null = null;
  let resolvedDescription = description;

  if (addStock) {
    if (!Number.isFinite(productId) || productId <= 0) {
      return { error: "Select a product to restock." };
    }
    if (!Number.isFinite(stockQty) || stockQty <= 0) {
      return { error: "Enter how many units to add to stock." };
    }

    const [product] = await db
      .select({ id: products.id, name: products.name, variant: products.variant })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.archived, false)))
      .limit(1);

    if (!product) {
      return { error: "Product not found." };
    }

    const branchId =
      Number.isFinite(branchIdRaw) && branchIdRaw > 0
        ? branchIdRaw
        : await getDefaultBranchId();

    const fundingNote =
      fundingSource === "investor_capital" ? "investor capital" : "shop cash";

    await adjustBranchStock({
      branchId,
      productId,
      delta: stockQty,
      movementType: "Restock",
      note: notes?.length
        ? `Restock paid from ${fundingNote} — ${notes}`
        : `Restock paid from ${fundingNote}`,
    });

    await tryAutoFulfillPreOrdersForProduct(productId);

    resolvedProductId = productId;
    resolvedBranchId = branchId;
    stockQtyAdded = stockQty;
    if (!resolvedDescription) {
      resolvedDescription = `Restock — ${product.name}${product.variant ? ` (${product.variant})` : ""}`;
    }
  } else if (!resolvedDescription) {
    return { error: "Description is required when not adding stock." };
  }

  if (Number.isFinite(supplierIdRaw) && supplierIdRaw > 0) {
    resolvedSupplierId = supplierIdRaw;
  }

  const [inserted] = await db
    .insert(shopCashOutflows)
    .values({
      kind: "restock",
      fundingSource,
      amountCents,
      description: resolvedDescription,
      vendor,
      reference,
      productId: resolvedProductId,
      branchId: resolvedBranchId,
      supplierId: resolvedSupplierId,
      stockQtyAdded,
      paidAt,
      notes,
      recordedByUserId: session?.userId ?? null,
    })
    .returning({ id: shopCashOutflows.id });

  let costMessage: string | null = null;
  if (addStock && resolvedProductId && stockQtyAdded && inserted?.id) {
    const costResult = await applyRestockUnitCostUpdate({
      productId: resolvedProductId,
      amountCents,
      stockQty: stockQtyAdded,
      supplierId: resolvedSupplierId,
      outflowId: inserted.id,
      userId: session?.userId ?? null,
    });
    costMessage = costResult.message;
  }

  revalidateShopCash();
  revalidatePath("/branches");
  revalidatePath("/preorders");
  revalidatePath("/orders");

  const parts: string[] = [];
  if (addStock) {
    parts.push("Restock payment recorded and stock updated.");
  } else {
    parts.push("Restock payment recorded.");
  }
  if (costMessage) {
    parts.push(costMessage);
  }

  return { ok: true, message: parts.join(" ") };
}

export async function deleteShopCashOutflow(
  _prev: ShopCashActionResult | null,
  formData: FormData,
): Promise<ShopCashActionResult> {
  await requireAdmin();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "Invalid entry." };
  }

  const [row] = await db
    .select({ id: shopCashOutflows.id, stockQtyAdded: shopCashOutflows.stockQtyAdded })
    .from(shopCashOutflows)
    .where(eq(shopCashOutflows.id, id))
    .limit(1);

  if (!row) {
    return { error: "Entry not found." };
  }

  if (row.stockQtyAdded != null && row.stockQtyAdded > 0) {
    return {
      error:
        "Cannot delete a restock that already added stock. Adjust inventory manually if needed.",
    };
  }

  await db.delete(shopCashOutflows).where(eq(shopCashOutflows.id, id));

  revalidateShopCash();
  return { ok: true, message: "Entry removed." };
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { branchStock, branches } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";

function revalidateBranchPaths() {
  revalidatePath("/branches");
  revalidatePath("/products");
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function createBranch(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (!name) throw new Error("Branch name is required.");

  if (isDefault) {
    await db.update(branches).set({ isDefault: false });
  }

  await db.insert(branches).values({
    name,
    location: locationRaw.length ? locationRaw : null,
    notes: notesRaw.length ? notesRaw : null,
    isDefault,
    active: true,
  });

  revalidateBranchPaths();
}

export async function updateBranch(formData: FormData) {
  await requireAdmin();

  const branchId = Number.parseInt(String(formData.get("branchId") ?? ""), 10);
  const name = String(formData.get("name") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (!Number.isFinite(branchId) || branchId <= 0) {
    throw new Error("Invalid branch.");
  }
  if (!name) throw new Error("Branch name is required.");

  const [existing] = await db
    .select({ id: branches.id, isDefault: branches.isDefault })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!existing) throw new Error("Branch not found.");

  if (isDefault) {
    await db.update(branches).set({ isDefault: false });
  } else if (existing.isDefault) {
    throw new Error(
      "This is your default shop branch. Set another branch as default before removing default from this one.",
    );
  }

  await db
    .update(branches)
    .set({
      name,
      location: locationRaw.length ? locationRaw : null,
      notes: notesRaw.length ? notesRaw : null,
      isDefault,
    })
    .where(eq(branches.id, branchId));

  revalidateBranchPaths();
}

export async function setBranchActive(formData: FormData) {
  await requireAdmin();

  const branchId = Number.parseInt(String(formData.get("branchId") ?? ""), 10);
  const active = formData.get("active") === "on";

  if (!Number.isFinite(branchId) || branchId <= 0) {
    throw new Error("Invalid branch.");
  }

  const [existing] = await db
    .select({ id: branches.id, isDefault: branches.isDefault })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!existing) throw new Error("Branch not found.");

  if (!active && existing.isDefault) {
    throw new Error("Cannot deactivate the default branch. Set another default first.");
  }

  if (!active) {
    const [stockRow] = await db
      .select({ id: branchStock.id })
      .from(branchStock)
      .where(
        and(eq(branchStock.branchId, branchId), gt(branchStock.stockQuantity, 0)),
      )
      .limit(1);
    if (stockRow) {
      throw new Error(
        "Move or zero out stock at this branch before deactivating it.",
      );
    }
  }

  await db.update(branches).set({ active }).where(eq(branches.id, branchId));
  revalidateBranchPaths();
}

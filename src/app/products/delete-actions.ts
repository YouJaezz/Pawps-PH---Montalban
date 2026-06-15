"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { db } from "@/db";
import { orderItems, products, stockMovements, branchStock } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function deleteProduct(formData: FormData) {
  await requireAdmin();

  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error("Invalid product.");
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!product) throw new Error("Product not found.");

  const usedInOrders = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.productId, productId))
    .limit(1);

  if (usedInOrders.length) {
    await db
      .update(products)
      .set({ archived: true, stockQuantity: 0 })
      .where(eq(products.id, productId));
  } else {
    await db.delete(stockMovements).where(eq(stockMovements.productId, productId));
    await db.delete(branchStock).where(eq(branchStock.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
  }

  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/orders");
}

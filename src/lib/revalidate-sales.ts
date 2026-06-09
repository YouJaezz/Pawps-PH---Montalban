import { revalidatePath } from "next/cache";

/** Invalidate pages that depend on order / payment data. */
export function revalidateSalesPages() {
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/investors");
  revalidatePath("/reports");
  revalidatePath("/customers");
  revalidatePath("/products");
  revalidatePath("/delivery");
}

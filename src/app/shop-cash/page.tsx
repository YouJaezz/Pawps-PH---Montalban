import { redirect } from "next/navigation";

import { productsShopCashHref } from "@/lib/nav-urls";

export default function ShopCashPage() {
  redirect(productsShopCashHref);
}

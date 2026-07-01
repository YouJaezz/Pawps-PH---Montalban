import { redirect } from "next/navigation";

import { productsSuppliersHref } from "@/lib/nav-urls";

export default function SuppliersPage() {
  redirect(productsSuppliersHref);
}

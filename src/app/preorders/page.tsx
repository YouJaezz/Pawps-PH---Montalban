import { redirect } from "next/navigation";

import { customersPreordersHref } from "@/lib/nav-urls";

export default function PreOrdersPage() {
  redirect(customersPreordersHref);
}

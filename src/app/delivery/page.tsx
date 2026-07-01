import { redirect } from "next/navigation";

import { ordersDeliveryHref } from "@/lib/nav-urls";

export default function DeliveryLogPage() {
  redirect(ordersDeliveryHref);
}

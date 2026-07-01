import { redirect } from "next/navigation";

import { CASHIER_HOME } from "@/lib/roles";

export default function TeamChatPage() {
  redirect(CASHIER_HOME);
}

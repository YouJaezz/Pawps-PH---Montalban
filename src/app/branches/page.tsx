import { redirect } from "next/navigation";

import { settingsBranchesHref } from "@/lib/nav-urls";

export default function BranchesPage() {
  redirect(settingsBranchesHref);
}

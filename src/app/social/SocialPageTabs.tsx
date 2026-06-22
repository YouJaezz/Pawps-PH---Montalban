"use client";

import Link from "next/link";

export function SocialPageTabs(props: {
  activeTab: "content" | "comments";
}) {
  const tabClass = (active: boolean) =>
    active
      ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200";

  return (
    <div className="flex gap-2 border-b border-white/10 pb-2">
      <Link
        href="/social?tab=content"
        className={`rounded-t-lg border px-4 py-2 text-xs font-medium ${tabClass(props.activeTab === "content")}`}
      >
        Content Performance
      </Link>
      <Link
        href="/social?tab=comments"
        className={`rounded-t-lg border px-4 py-2 text-xs font-medium ${tabClass(props.activeTab === "comments")}`}
      >
        Comments
      </Link>
    </div>
  );
}

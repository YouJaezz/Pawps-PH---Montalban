"use client";

import Link from "next/link";

import { UnreadBadge, useTeamChat } from "@/components/TeamChatNotifier";

export function TeamChatNavLink() {
  const chat = useTeamChat();
  const unread = chat?.unreadCount ?? 0;

  return (
    <Link
      href="/team-chat"
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
    >
      <span className="flex items-center gap-2">
        Team chat
        <UnreadBadge count={unread} />
      </span>
      <span className="text-[11px] text-zinc-500">staff</span>
    </Link>
  );
}

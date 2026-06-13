"use client";

import { UnreadBadge, useTeamChat } from "@/components/TeamChatNotifier";
import { requestChatNotificationPermission, unlockChatAudio } from "@/lib/chat-notify";

export function TeamChatPageHeader() {
  const chat = useTeamChat();
  const unread = chat?.unreadCount ?? 0;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
          Team
          <UnreadBadge count={unread} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          Team chat
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Staff messaging with sound alerts and pop-up notifications.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          unlockChatAudio();
          void requestChatNotificationPermission();
        }}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/10"
      >
        Enable notifications
      </button>
    </div>
  );
}

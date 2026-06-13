"use client";

import Link from "next/link";

import { TeamChatPanel } from "@/components/TeamChatPanel";
import { UnreadBadge } from "@/components/TeamChatNotifier";

export function TeamChatWidget(props: {
  userId: number;
  userName: string;
  isAdmin: boolean;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  unreadCount: number;
  onMessagesSeen: () => void;
}) {
  return (
    <>
      {props.chatOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 sm:items-center sm:justify-center print:hidden">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-black/50"
            onClick={() => props.setChatOpen(false)}
          />
          <div className="relative z-10 flex h-[min(85vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1018] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
              <div className="text-xs text-zinc-400">
                Signed in as{" "}
                <span className="text-zinc-200">{props.userName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/team-chat"
                  onClick={() => props.setChatOpen(false)}
                  className="text-[10px] text-zinc-500 underline hover:text-zinc-300"
                >
                  Full page
                </Link>
                <button
                  type="button"
                  onClick={() => props.setChatOpen(false)}
                  className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <TeamChatPanel
                userId={props.userId}
                isAdmin={props.isAdmin}
                compact
                markReadOnView
                onUnreadChange={(count) => {
                  if (count === 0) props.onMessagesSeen();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => props.setChatOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-brand-blue/40 bg-surface-elevated px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-lg hover:bg-surface print:hidden"
      >
        <span>Team chat</span>
        <UnreadBadge count={props.unreadCount} />
      </button>
    </>
  );
}

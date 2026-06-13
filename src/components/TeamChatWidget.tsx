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
            className="absolute inset-0 bg-black/40"
            onClick={() => props.setChatOpen(false)}
          />
          <div className="relative z-10 flex h-[min(85vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2.5">
              <div className="text-sm text-zinc-600">
                Signed in as{" "}
                <span className="font-medium text-zinc-900">{props.userName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/team-chat"
                  onClick={() => props.setChatOpen(false)}
                  className="text-xs text-brand-blue underline hover:text-brand-blue/80"
                >
                  Full page
                </Link>
                <button
                  type="button"
                  onClick={() => props.setChatOpen(false)}
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
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
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-brand-blue/30 bg-white px-4 py-2.5 text-sm font-semibold text-brand-blue shadow-lg shadow-brand-blue/10 hover:bg-brand-blue/5 print:hidden"
      >
        <span>Team chat</span>
        <UnreadBadge count={props.unreadCount} />
      </button>
    </>
  );
}

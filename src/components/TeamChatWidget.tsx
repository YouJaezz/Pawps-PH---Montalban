"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { TeamChatPanel } from "@/components/TeamChatPanel";

export function TeamChatWidget(props: {
  userId: number;
  userName: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const pollUnread = useCallback(async () => {
    if (open) return;
    try {
      const res = await fetch("/api/chat/messages");
      if (!res.ok) return;
      const data = (await res.json()) as { unreadCount: number };
      setUnread(data.unreadCount);
    } catch {
      /* ignore background poll errors */
    }
  }, [open]);

  useEffect(() => {
    void pollUnread();
    const id = setInterval(() => void pollUnread(), 15000);
    return () => clearInterval(id);
  }, [pollUnread]);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 sm:items-center sm:justify-center">
          <button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex h-[min(85vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b10] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
              <div className="text-xs text-zinc-400">
                Signed in as{" "}
                <span className="text-zinc-200">{props.userName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/team-chat"
                  onClick={() => setOpen(false)}
                  className="text-[10px] text-zinc-500 underline hover:text-zinc-300"
                >
                  Full page
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
                onUnreadChange={setUnread}
              />
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-[#e8a44a]/40 bg-[#13131f] px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-lg hover:bg-[#1a1a28]"
      >
        <span>Team chat</span>
        {unread > 0 ? (
          <span className="flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
    </>
  );
}

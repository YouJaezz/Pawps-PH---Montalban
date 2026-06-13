"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TeamChatMessage } from "@/db/queries/team-chat";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TeamChatPanel(props: {
  userId: number;
  isAdmin: boolean;
  compact?: boolean;
  markReadOnView?: boolean;
  onUnreadChange?: (count: number) => void;
}) {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    lastIdRef.current =
      messages.length > 0 ? messages[messages.length - 1]!.id : 0;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(
    async (opts: { afterId?: number; markRead?: boolean }) => {
      const qs = new URLSearchParams();
      if (opts.afterId && opts.afterId > 0) qs.set("after", String(opts.afterId));
      if (opts.markRead) qs.set("markRead", "1");

      const res = await fetch(`/api/chat/messages?${qs.toString()}`);
      if (!res.ok) throw new Error("Could not load messages.");
      return (await res.json()) as {
        messages: TeamChatMessage[];
        unreadCount: number;
      };
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMessages({
          markRead: props.markReadOnView ?? true,
        });
        if (cancelled) return;
        setMessages(data.messages);
        props.onUnreadChange?.(data.unreadCount);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMessages, props.markReadOnView, props.onUnreadChange]);

  useEffect(() => {
    const poll = setInterval(() => {
      void (async () => {
        try {
          const afterId = lastIdRef.current;
          const data = await fetchMessages({
            afterId: afterId > 0 ? afterId : undefined,
            markRead: props.markReadOnView,
          });
          if (data.messages.length > 0) {
            setMessages((prev) => {
              const ids = new Set(prev.map((m) => m.id));
              const merged = [...prev];
              for (const m of data.messages) {
                if (!ids.has(m.id)) merged.push(m);
              }
              return merged;
            });
          }
          props.onUnreadChange?.(data.unreadCount);
        } catch {
          /* background poll */
        }
      })();
    }, 5000);
    return () => clearInterval(poll);
  }, [fetchMessages, props.markReadOnView, props.onUnreadChange]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: text,
          isAnnouncement: announce,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: TeamChatMessage;
      };
      if (!res.ok) throw new Error(data.error ?? "Send failed.");

      if (data.message) {
        setMessages((prev) => [...prev, data.message!]);
      }
      setDraft("");
      setAnnounce(false);
      props.onUnreadChange?.(0);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c0c12] ${
        props.compact ? "h-full min-h-0" : "h-[min(70vh,560px)]"
      }`}
    >
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="text-sm font-medium text-zinc-100">Team chat</div>
        <div className="text-[10px] text-zinc-500">
          Messages sync every few seconds · staff only
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-center text-xs text-zinc-500">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-zinc-500">
            No messages yet. Say hello to the team.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                  m.isAnnouncement
                    ? "border border-[#e8a44a]/40 bg-[#e8a44a]/15 text-[#ffe8c4]"
                    : m.isOwn
                      ? "bg-[#e8a44a]/20 text-zinc-100"
                      : "bg-white/10 text-zinc-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium">
                    {m.isOwn ? "You" : m.senderName}
                  </span>
                  {m.isAnnouncement ? (
                    <span className="text-[9px] uppercase tracking-wide text-[#e8a44a]">
                      Announcement
                    </span>
                  ) : null}
                  <span className="text-[9px] text-zinc-500">
                    {fmtTime(m.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div className="shrink-0 px-4 pb-2 text-[10px] text-red-300">{error}</div>
      ) : null}

      <form
        onSubmit={sendMessage}
        className="shrink-0 border-t border-white/10 p-3"
      >
        {props.isAdmin ? (
          <label className="mb-2 flex items-center gap-2 text-[10px] text-zinc-400">
            <input
              type="checkbox"
              checked={announce}
              onChange={(e) => setAnnounce(e.target.checked)}
              className="rounded border-white/20"
            />
            Pin as announcement (highlighted for everyone)
          </label>
        ) : null}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-50 outline-none focus:border-white/25"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

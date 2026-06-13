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
      className={`flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white ${
        props.compact ? "h-full min-h-0" : "h-[min(70vh,560px)]"
      }`}
    >
      <div className="shrink-0 border-b border-zinc-200 px-4 py-3">
        <div className="text-sm font-medium text-zinc-800">Team chat</div>
        <div className="text-[10px] text-zinc-600">
          Messages sync every few seconds · staff only
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-center text-xs text-zinc-600">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-zinc-600">
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
                    ? "border border-brand-blue/40 bg-brand-blue/15 text-brand-cyan/90"
                    : m.isOwn
                      ? "bg-brand-blue/20 text-zinc-800"
                      : "bg-zinc-100 text-zinc-800"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium">
                    {m.isOwn ? "You" : m.senderName}
                  </span>
                  {m.isAnnouncement ? (
                    <span className="text-[9px] uppercase tracking-wide text-brand-blue">
                      Announcement
                    </span>
                  ) : null}
                  <span className="text-[9px] text-zinc-600">
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
        <div className="shrink-0 px-4 pb-2 text-[10px] text-red-700">{error}</div>
      ) : null}

      <form
        onSubmit={sendMessage}
        className="shrink-0 border-t border-zinc-200 p-3"
      >
        {props.isAdmin ? (
          <label className="mb-2 flex items-center gap-2 text-[10px] text-zinc-600">
            <input
              type="checkbox"
              checked={announce}
              onChange={(e) => setAnnounce(e.target.checked)}
              className="rounded border-zinc-300"
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
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

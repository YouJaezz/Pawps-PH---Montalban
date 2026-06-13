"use client";

import { useEffect } from "react";

export type ChatToastItem = {
  id: number;
  senderName: string;
  body: string;
  isAnnouncement: boolean;
};

export function ChatToastStack(props: {
  toasts: ChatToastItem[];
  onDismiss: (id: number) => void;
  onOpen: (id: number) => void;
}) {
  useEffect(() => {
    if (props.toasts.length === 0) return;
    const timers = props.toasts.map((t) =>
      setTimeout(() => props.onDismiss(t.id), 7000),
    );
    return () => timers.forEach(clearTimeout);
  }, [props.toasts, props.onDismiss]);

  if (props.toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-24 right-5 z-[70] flex w-[min(100vw-2.5rem,320px)] flex-col gap-2 print:hidden"
      aria-live="polite"
    >
      {props.toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            props.onDismiss(t.id);
            props.onOpen(t.id);
          }}
          className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-[#e8a44a]/40 bg-[#13131f]/95 p-3 text-left shadow-xl backdrop-blur transition hover:bg-[#1a1a28]"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e8a44a]/20 text-sm font-bold text-[#e8a44a]">
            {t.senderName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-xs font-semibold text-zinc-100">
                {t.senderName}
              </span>
              {t.isAnnouncement ? (
                <span className="shrink-0 rounded bg-[#e8a44a]/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#e8a44a]">
                  Alert
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 line-clamp-2 text-[11px] text-zinc-400">
              {t.body}
            </span>
            <span className="mt-1 block text-[9px] text-zinc-600">
              Tap to open chat
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

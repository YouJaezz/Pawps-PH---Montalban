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
          className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-lg transition hover:bg-zinc-50"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-bold text-brand-blue">
            {t.senderName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-zinc-900">
                {t.senderName}
              </span>
              {t.isAnnouncement ? (
                <span className="shrink-0 rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
                  Alert
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 line-clamp-2 text-sm text-zinc-600">
              {t.body}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              Tap to open chat
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

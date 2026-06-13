"use client";

import { ReactNode, useEffect } from "react";

export function EditModal(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const maxW = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  }[props.maxWidth ?? "md"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
      onClick={props.onClose}
    >
      <div
        className={`my-4 w-full ${maxW} rounded-2xl border border-white/10 bg-[#13131f] shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-zinc-50">{props.title}</div>
            {props.subtitle ? (
              <div className="mt-0.5 text-[11px] text-zinc-500">{props.subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:bg-white/5"
          >
            Close
          </button>
        </div>
        <div className="max-h-[min(75vh,640px)] overflow-y-auto p-4">{props.children}</div>
      </div>
    </div>
  );
}

export const modalFieldClass =
  "app-select w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-50 outline-none focus:border-white/20";

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
      onClick={props.onClose}
    >
      <div
        className={`my-4 w-full ${maxW} rounded-2xl border border-zinc-200 bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <div className="font-brand text-base font-semibold text-zinc-900">
              {props.title}
            </div>
            {props.subtitle ? (
              <div className="mt-0.5 text-sm text-zinc-600">{props.subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
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
  "app-select w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

"use client";

export function PrintButton(props: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        props.className ??
        "rounded border border-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/5"
      }
    >
      {props.label ?? "Print"}
    </button>
  );
}

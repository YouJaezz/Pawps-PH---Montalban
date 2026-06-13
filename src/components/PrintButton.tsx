"use client";

export function PrintButton(props: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        props.className ??
        "rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50"
      }
    >
      {props.label ?? "Print"}
    </button>
  );
}

"use client";

export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-200"
    >
      Print receipt
    </button>
  );
}

"use client";

export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-800"
    >
      Print receipt
    </button>
  );
}

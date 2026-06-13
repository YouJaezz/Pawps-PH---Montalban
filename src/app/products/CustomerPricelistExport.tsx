"use client";

import { useState } from "react";

type PriceTier = "retail" | "wholesale";

export function CustomerPricelistExport() {
  const [tier, setTier] = useState<PriceTier>("retail");

  function exportPricelist() {
    const url = `/api/export/customer-pricelist?tier=${tier}`;
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.alert("Allow pop-ups to open the price list for PDF export.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={tier}
        onChange={(e) => setTier(e.target.value as PriceTier)}
        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-50 outline-none"
        aria-label="Price list type"
      >
        <option value="retail">Retail prices</option>
        <option value="wholesale">Wholesale prices</option>
      </select>
      <button
        type="button"
        onClick={exportPricelist}
        className="rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-3 py-1.5 text-xs text-brand-blue hover:bg-brand-blue/15"
      >
        Customer pricelist
      </button>
    </div>
  );
}

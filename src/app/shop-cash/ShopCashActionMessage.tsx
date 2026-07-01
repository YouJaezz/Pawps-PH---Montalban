"use client";

import type { ShopCashActionResult } from "@/app/shop-cash/actions";

export function ActionMessage(props: { result: ShopCashActionResult | null }) {
  if (!props.result) return null;
  if (props.result.error) {
    return (
      <p className="mt-2 text-xs text-red-300" role="alert">
        {props.result.error}
      </p>
    );
  }
  if (props.result.message) {
    return (
      <p className="mt-2 text-xs text-emerald-300" role="status">
        {props.result.message}
      </p>
    );
  }
  return null;
}

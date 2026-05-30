"use client";

import { useState } from "react";

import { getTrackingUrl } from "@/lib/site-url";

export function CopyTrackingLink(props: { token: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const url = getTrackingUrl(props.token);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this customer tracking link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copyLink()}
      className={
        props.className ??
        "rounded border border-amber-500/30 px-2 py-0.5 text-amber-200"
      }
    >
      {copied ? "Link copied!" : "Copy customer link"}
    </button>
  );
}

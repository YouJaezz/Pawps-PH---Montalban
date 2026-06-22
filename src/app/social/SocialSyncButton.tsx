"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SocialApiConfig } from "@/lib/social-engagement";
import { formatSocialDate } from "@/lib/social-engagement";

export function SocialSyncButton(props: {
  config: SocialApiConfig;
  lastSyncedLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncNow() {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/social/sync", { method: "POST" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        facebookPosts?: number;
        facebookComments?: number;
        tiktokPosts?: number;
        errors?: string[];
      };

      if (!res.ok) {
        setError(json.error ?? "Sync failed.");
        return;
      }

      const parts: string[] = [];
      if (json.facebookPosts) {
        parts.push(`${json.facebookPosts} Facebook posts`);
      }
      if (json.facebookComments) {
        parts.push(`${json.facebookComments} comments`);
      }
      if (json.tiktokPosts) {
        parts.push(`${json.tiktokPosts} TikTok videos`);
      }

      if (parts.length === 0) {
        setMessage("Sync finished — no new items returned.");
      } else {
        setMessage(`Synced ${parts.join(" · ")}.`);
      }

      if (json.errors?.length) {
        setError(json.errors.join(" "));
      }

      router.refresh();
    } catch {
      setError("Could not reach sync API.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void syncNow()}
        disabled={pending || !props.config.anyConfigured}
        className="rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      <div className="text-[10px] text-zinc-500">
        Last sync: {props.lastSyncedLabel}
      </div>
      {message ? (
        <div className="max-w-xs text-right text-[10px] text-emerald-400">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="max-w-xs text-right text-[10px] text-red-400">{error}</div>
      ) : null}
    </div>
  );
}

export function formatLastSynced(d: Date | null) {
  if (!d) return "Never";
  return formatSocialDate(d);
}

"use client";

import { useMemo, useState } from "react";

import { ScrollableTable } from "@/components/ScrollableTable";
import { TableToolbar } from "@/components/TableToolbar";
import type { SocialContentRow } from "@/db/queries/social-engagements";
import { formatCount } from "@/lib/social-engagement";
import { matchesQuery } from "@/lib/table-filter";

function PlatformBadge(props: { label: string; platform: string }) {
  const tone =
    props.platform === "facebook"
      ? "bg-blue-500/15 text-blue-300"
      : "bg-fuchsia-500/15 text-fuchsia-300";

  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      {props.label}
    </span>
  );
}

export function SocialContentTable(props: { rows: SocialContentRow[] }) {
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = props.rows;
    if (platformFilter !== "all") {
      list = list.filter((r) => r.platform === platformFilter);
    }
    if (query.trim()) {
      list = list.filter((r) => matchesQuery(r.searchText, query));
    }
    return list;
  }, [props.rows, query, platformFilter]);

  return (
    <div>
      <TableToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search caption, platform…"
        shown={filtered.length}
        total={props.rows.length}
        filters={[
          {
            id: "platform",
            value: platformFilter,
            onChange: setPlatformFilter,
            "aria-label": "Filter platform",
            options: [
              { value: "all", label: "All platforms" },
              { value: "facebook", label: "Facebook" },
              { value: "tiktok", label: "TikTok" },
            ],
          },
        ]}
      />
      <ScrollableTable maxHeight="max-h-[min(60vh,560px)]" className="mt-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-900 text-left text-[10px] text-zinc-500">
            <tr>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Views</th>
              <th className="px-3 py-2">Likes</th>
              <th className="px-3 py-2">Comments</th>
              <th className="px-3 py-2">Shares</th>
              <th className="px-3 py-2">Engagement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  {props.rows.length === 0
                    ? "No content synced yet. Connect your accounts and click Sync now."
                    : "No matches for this filter."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-white/5">
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      {row.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.thumbnailUrl}
                          alt=""
                          className="size-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/5 text-[10px] text-zinc-600">
                          —
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="mb-1">
                          <PlatformBadge
                            label={row.platformLabel}
                            platform={row.platform}
                          />
                        </div>
                        <div className="line-clamp-2 text-zinc-200">{row.caption}</div>
                        {row.permalink ? (
                          <a
                            href={row.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-[10px] text-brand-blue hover:underline"
                          >
                            Open post →
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-zinc-400">
                    {row.publishedLabel}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">
                    {formatCount(row.viewCount)}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">
                    {formatCount(row.likeCount)}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">
                    {formatCount(row.commentCount)}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">
                    {formatCount(row.shareCount)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-zinc-200">
                      {formatCount(row.engagementTotal)}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {row.engagementRate} rate
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}

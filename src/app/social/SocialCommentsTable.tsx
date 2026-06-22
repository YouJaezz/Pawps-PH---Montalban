"use client";

import { useMemo, useState } from "react";

import { ScrollableTable } from "@/components/ScrollableTable";
import { TableToolbar } from "@/components/TableToolbar";
import type { SocialCommentRow } from "@/db/queries/social-engagements";
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

export function SocialCommentsTable(props: { rows: SocialCommentRow[] }) {
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
        placeholder="Search author, comment, post…"
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
              <th className="px-3 py-2">Comment</th>
              <th className="px-3 py-2">On post</th>
              <th className="px-3 py-2">Likes</th>
              <th className="px-3 py-2">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                  {props.rows.length === 0
                    ? "No comments synced yet. Facebook comments import when you sync."
                    : "No matches for this filter."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-white/5">
                  <td className="px-3 py-3">
                    <div className="mb-1">
                      <PlatformBadge
                        label={row.platformLabel}
                        platform={row.platform}
                      />
                    </div>
                    <div className="font-medium text-zinc-200">{row.authorName}</div>
                    <div className="mt-1 text-zinc-300">{row.message}</div>
                    {row.permalink ? (
                      <a
                        href={row.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[10px] text-brand-blue hover:underline"
                      >
                        View comment →
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 max-w-[220px]">
                    <div className="line-clamp-3 text-zinc-400">{row.postCaption}</div>
                    {row.postPermalink ? (
                      <a
                        href={row.postPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[10px] text-zinc-500 hover:text-brand-blue hover:underline"
                      >
                        Open post
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-zinc-300">
                    {formatCount(row.likeCount)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-zinc-400">
                    {row.publishedLabel}
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

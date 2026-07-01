"use client";

import Link from "next/link";

export type SectionTab = {
  id: string;
  label: string;
  href: string;
  hint?: string;
};

export function SectionTabs(props: { tabs: SectionTab[]; activeTab: string }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
      {props.tabs.map((tab) => {
        const active = props.activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`rounded-t-lg border px-4 py-2 text-xs font-medium ${
              active
                ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
            }`}
          >
            {tab.label}
            {tab.hint ? (
              <span className="ml-1.5 font-normal text-[10px] opacity-70">{tab.hint}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

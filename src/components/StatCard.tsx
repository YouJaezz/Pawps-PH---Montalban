import { ReactNode } from "react";

export function StatCard(props: {
  title: string;
  value: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  compact?: boolean;
}) {
  const shell = props.accent
    ? "border-brand-blue/30 bg-gradient-to-br from-brand-blue/15 to-brand-cyan/10"
    : "border-white/10 bg-white/5";
  const pad = props.compact ? "p-4" : "p-5";
  const valueSize = props.compact ? "text-xl" : "text-2xl";

  return (
    <div
      className={`rounded-2xl border shadow-sm backdrop-blur ${shell} ${pad}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className={
              props.compact
                ? "text-[11px] text-zinc-500"
                : "text-sm text-zinc-300"
            }
          >
            {props.title}
          </div>
          <div
            className={`mt-1 font-semibold tracking-tight text-zinc-50 ${valueSize}`}
          >
            {props.value}
          </div>
          {props.subtitle ? (
            <div
              className={
                props.compact
                  ? "mt-0.5 text-[10px] text-zinc-500"
                  : "mt-1 text-sm text-zinc-400"
              }
            >
              {props.subtitle}
            </div>
          ) : null}
        </div>
        {props.icon ? (
          <div className="grid size-10 place-items-center rounded-xl bg-white/10 text-zinc-100">
            {props.icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

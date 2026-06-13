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
    ? "border-brand-blue/30 bg-gradient-to-br from-brand-blue/10 to-brand-cyan/5"
    : "border-zinc-200 bg-white";
  const pad = props.compact ? "p-4" : "p-5";
  const valueSize = props.compact ? "text-xl" : "text-2xl";

  return (
    <div className={`rounded-2xl border shadow-sm ${shell} ${pad}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className={
              props.compact
                ? "text-xs font-medium text-zinc-600"
                : "text-sm font-medium text-zinc-600"
            }
          >
            {props.title}
          </div>
          <div
            className={`mt-1 font-semibold tracking-tight text-zinc-900 ${valueSize}`}
          >
            {props.value}
          </div>
          {props.subtitle ? (
            <div
              className={
                props.compact
                  ? "mt-1 text-xs text-zinc-600"
                  : "mt-1 text-sm text-zinc-600"
              }
            >
              {props.subtitle}
            </div>
          ) : null}
        </div>
        {props.icon ? (
          <div className="grid size-10 place-items-center rounded-xl bg-brand-blue/10 text-brand-blue">
            {props.icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

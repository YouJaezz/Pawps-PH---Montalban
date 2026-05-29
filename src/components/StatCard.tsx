import { ReactNode } from "react";

export function StatCard(props: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-zinc-300">{props.title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
            {props.value}
          </div>
          {props.subtitle ? (
            <div className="mt-1 text-sm text-zinc-400">{props.subtitle}</div>
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


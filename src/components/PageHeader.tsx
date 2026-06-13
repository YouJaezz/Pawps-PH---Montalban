import { ReactNode } from "react";

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {props.eyebrow ? (
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-600">
            {props.eyebrow}
          </div>
        ) : null}
        <h1 className="font-brand text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          {props.title}
        </h1>
        {props.description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-600">
            {props.description}
          </p>
        ) : null}
      </div>
      {props.actions ? (
        <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
      ) : null}
    </div>
  );
}

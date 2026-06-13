"use client";

export type TableFilterOption = { value: string; label: string };

export type TableFilterConfig = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: TableFilterOption[];
  "aria-label"?: string;
  className?: string;
};

const inputClass =
  "min-w-[140px] flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-zinc-50 outline-none focus:border-white/20 sm:max-w-xs";

const selectClass =
  "rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-zinc-50 outline-none";

export function TableToolbar(props: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  filters?: TableFilterConfig[];
  shown: number;
  total: number;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-2 ${props.className ?? ""}`}
    >
      <input
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
        placeholder={props.placeholder ?? "Search…"}
        className={inputClass}
      />
      {props.filters?.map((f) => (
        <select
          key={f.id}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          aria-label={f["aria-label"] ?? f.id}
          className={f.className ?? selectClass}
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      <span className="text-[10px] text-zinc-500">
        {props.shown === props.total
          ? `${props.total} shown`
          : `${props.shown} / ${props.total}`}
      </span>
    </div>
  );
}

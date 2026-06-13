import { ReactNode } from "react";

type ScrollableTableProps = {
  children: ReactNode;
  className?: string;
  /** e.g. "max-h-[min(70vh,720px)]" — defaults to a viewport-aware cap */
  maxHeight?: string;
};

export function ScrollableTable({
  children,
  className = "",
  maxHeight = "max-h-[min(65vh,640px)]",
}: ScrollableTableProps) {
  return (
    <div
      className={`mt-4 overflow-hidden rounded-xl border border-white/10 ${className}`}
    >
      <div className={`scrollable-table-body ${maxHeight} overflow-auto`}>
        {children}
      </div>
    </div>
  );
}

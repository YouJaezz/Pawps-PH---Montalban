import Link from "next/link";

export function PayrollPrintSlipLink(props: {
  userId: number;
  year: number;
  month: number;
  compact?: boolean;
}) {
  const href = `/payroll/slip/${props.userId}?year=${props.year}&month=${props.month}`;

  if (props.compact) {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded border border-[#e8a44a]/40 bg-[#e8a44a]/10 px-2 py-0.5 text-[10px] font-medium text-[#e8a44a] hover:bg-[#e8a44a]/20"
      >
        Print slip
      </Link>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg border border-[#e8a44a]/40 bg-[#e8a44a]/15 px-3 py-1.5 text-[11px] font-medium text-[#e8a44a] hover:bg-[#e8a44a]/25"
    >
      Print payroll slip ↗
    </Link>
  );
}

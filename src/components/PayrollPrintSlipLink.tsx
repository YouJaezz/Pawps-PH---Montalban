import Link from "next/link";

export function PayrollPrintSlipLink(props: {
  userId: number;
  year: number;
  month: number;
  half: 0 | 1 | 2;
  compact?: boolean;
}) {
  const href = `/payroll/slip/${props.userId}?year=${props.year}&month=${props.month}&half=${props.half}`;

  if (props.compact) {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded border border-brand-blue/40 bg-brand-blue/10 px-2 py-0.5 text-[10px] font-medium text-brand-blue hover:bg-brand-blue/20"
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
      className="inline-flex items-center rounded-lg border border-brand-blue/40 bg-brand-blue/15 px-3 py-1.5 text-[11px] font-medium text-brand-blue hover:bg-brand-blue/25"
    >
      Print payroll slip ↗
    </Link>
  );
}

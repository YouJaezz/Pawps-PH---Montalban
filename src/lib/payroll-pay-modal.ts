export type PayrollPayModalRow =
  | {
      kind: "record";
      payoutId: number;
      employeeName: string;
      label: string;
      grossPayCents: number;
    }
  | {
      kind: "lock_and_pay";
      userId: number;
      year: number;
      month: number;
      half: 0 | 1 | 2;
      periodDay: number;
      employeeName: string;
      label: string;
      grossPayCents: number;
    };

export function payrollRowToPayModal(row: {
  userId: number;
  year: number;
  month: number;
  half: 0 | 1 | 2;
  periodDay: number;
  employeeName: string;
  label: string;
  grossPayCents: number;
  payoutId: number | null;
  status: "Open" | "Projected" | "Accrued" | "Paid";
  canGenerate: boolean;
}): PayrollPayModalRow | null {
  if (row.status === "Accrued" && row.payoutId) {
    return {
      kind: "record",
      payoutId: row.payoutId,
      employeeName: row.employeeName,
      label: row.label,
      grossPayCents: row.grossPayCents,
    };
  }

  if (row.canGenerate) {
    return {
      kind: "lock_and_pay",
      userId: row.userId,
      year: row.year,
      month: row.month,
      half: row.half,
      periodDay: row.periodDay,
      employeeName: row.employeeName,
      label: row.label,
      grossPayCents: row.grossPayCents,
    };
  }

  return null;
}

export type PayrollSlipData = {
  employeeName: string;
  employeeCode: string;
  periodLabel: string;
  year: number;
  month: number;
  half: 0 | 1 | 2;
  /** 1-31 for daily pay slips; 0 for semi-monthly */
  periodDay?: number;
  minutesWorked: number;
  hourlyRateCents: number;
  grossPayCents: number;
  status: string;
  paidAt: string | null;
  shiftCount: number;
  daysWorked: number;
  punches: Array<{
    dateKey: string;
    clockIn: string;
    clockOut: string | null;
    minutes: number;
  }>;
  daySummaries: Array<{
    dateKey: string;
    weekday: string;
    dayLabel: string;
    totalMinutes: number;
    shiftCount: number;
    scheduleCompact: string;
    dayPayCents: number;
  }>;
};

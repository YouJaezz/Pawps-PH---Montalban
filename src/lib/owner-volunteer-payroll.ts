import {
  allocateAmountBySplit,
  type OwnerProfitSplitSettings,
} from "@/lib/owner-profit-split";
import { PH_TIMEZONE } from "@/lib/ph-time";

export const VOLUNTEER_WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export function volunteerWeekdayLabel(weekday: number | null | undefined) {
  if (weekday == null) return "Not set";
  return VOLUNTEER_WEEKDAYS.find((d) => d.value === weekday)?.label ?? "Not set";
}

export function phWeekdayIndexFromDateKey(dateKey: string): number {
  const weekdayName = new Date(`${dateKey}T12:00:00+08:00`).toLocaleDateString(
    "en-US",
    { timeZone: PH_TIMEZONE, weekday: "long" },
  );
  const map: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  return map[weekdayName] ?? 0;
}

export function payrollRowKey(input: {
  userId: number;
  year: number;
  month: number;
  half: 0 | 1 | 2;
  periodDay: number;
}) {
  return `${input.userId}-${input.year}-${input.month}-${input.half}-${input.periodDay}`;
}

export function volunteerOwnerForWeekday(
  weekday: number,
  settings: OwnerProfitSplitSettings,
): "owner1" | "owner2" | null {
  if (
    settings.owner1VolunteerWeekday != null &&
    settings.owner1VolunteerWeekday === weekday
  ) {
    return "owner1";
  }
  if (
    settings.owner2VolunteerWeekday != null &&
    settings.owner2VolunteerWeekday === weekday
  ) {
    return "owner2";
  }
  return null;
}

export function validateVolunteerWeekdays(settings: OwnerProfitSplitSettings) {
  const { owner1VolunteerWeekday, owner2VolunteerWeekday } = settings;
  if (
    owner1VolunteerWeekday != null &&
    owner2VolunteerWeekday != null &&
    owner1VolunteerWeekday === owner2VolunteerWeekday
  ) {
    return "Each owner needs a different volunteer day of the week.";
  }
  if (
    owner1VolunteerWeekday != null &&
    (owner1VolunteerWeekday < 0 || owner1VolunteerWeekday > 6)
  ) {
    return "Invalid volunteer day for owner 1.";
  }
  if (
    owner2VolunteerWeekday != null &&
    (owner2VolunteerWeekday < 0 || owner2VolunteerWeekday > 6)
  ) {
    return "Invalid volunteer day for owner 2.";
  }
  return null;
}

export type UnpaidPayrollItem = {
  rowKey: string;
  userId: number;
  employeeName: string;
  label: string;
  status: "ready" | "accrued";
  grossPayCents: number;
  minutesWorked: number;
  dayPayLines: Array<{ dateKey: string; dayPayCents: number }>;
};

export type UnpaidPayrollDayLine = {
  dateKey: string;
  weekdayLabel: string;
  dayPayCents: number;
  responsibility: "owner1" | "owner2" | "shared";
  responsibilityLabel: string;
};

export type UnpaidPayrollSplitBreakdown = {
  rowKey: string;
  userId: number;
  employeeName: string;
  label: string;
  status: "ready" | "accrued";
  grossPayCents: number;
  minutesWorked: number;
  owner1VolunteerCents: number;
  owner2VolunteerCents: number;
  sharedCents: number;
  owner1TotalCents: number;
  owner2TotalCents: number;
  staffPoolCents: number;
  dayLines: UnpaidPayrollDayLine[];
};

export function buildUnpaidPayrollSplitBreakdown(
  item: UnpaidPayrollItem,
  settings: OwnerProfitSplitSettings,
): UnpaidPayrollSplitBreakdown {
  let owner1VolunteerCents = 0;
  let owner2VolunteerCents = 0;
  let sharedCents = 0;
  const dayLines: UnpaidPayrollDayLine[] = [];

  for (const day of item.dayPayLines) {
    if (day.dayPayCents <= 0) continue;

    const weekday = phWeekdayIndexFromDateKey(day.dateKey);
    const weekdayLabel = volunteerWeekdayLabel(weekday);
    const volunteer = volunteerOwnerForWeekday(weekday, settings);

    if (volunteer === "owner1") {
      owner1VolunteerCents += day.dayPayCents;
      dayLines.push({
        dateKey: day.dateKey,
        weekdayLabel,
        dayPayCents: day.dayPayCents,
        responsibility: "owner1",
        responsibilityLabel: `${settings.owner1Name} — volunteer day (pay full)`,
      });
      continue;
    }

    if (volunteer === "owner2") {
      owner2VolunteerCents += day.dayPayCents;
      dayLines.push({
        dateKey: day.dateKey,
        weekdayLabel,
        dayPayCents: day.dayPayCents,
        responsibility: "owner2",
        responsibilityLabel: `${settings.owner2Name} — volunteer day (pay full)`,
      });
      continue;
    }

    sharedCents += day.dayPayCents;
    dayLines.push({
      dateKey: day.dateKey,
      weekdayLabel,
      dayPayCents: day.dayPayCents,
      responsibility: "shared",
      responsibilityLabel: "Split — owner wallets + shop cash %",
    });
  }

  const alloc = allocateAmountBySplit(sharedCents, settings);

  return {
    rowKey: item.rowKey,
    userId: item.userId,
    employeeName: item.employeeName,
    label: item.label,
    status: item.status,
    grossPayCents: item.grossPayCents,
    minutesWorked: item.minutesWorked,
    owner1VolunteerCents,
    owner2VolunteerCents,
    sharedCents,
    owner1TotalCents: owner1VolunteerCents + alloc.owner1Cents,
    owner2TotalCents: owner2VolunteerCents + alloc.owner2Cents,
    staffPoolCents: alloc.payrollPoolCents,
    dayLines,
  };
}

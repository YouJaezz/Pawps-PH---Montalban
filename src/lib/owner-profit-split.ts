import type { MonthlyNetIncome } from "@/lib/investor-income";

export type OwnerProfitSplitSettings = {
  owner1Name: string;
  owner2Name: string;
  owner1Percent: number;
  owner2Percent: number;
  payrollPoolPercent: number;
  /** 0=Sunday … 6=Saturday; null = no volunteer day */
  owner1VolunteerWeekday: number | null;
  owner2VolunteerWeekday: number | null;
};

export const DEFAULT_OWNER_PROFIT_SPLIT: OwnerProfitSplitSettings = {
  owner1Name: "Owner 1",
  owner2Name: "Owner 2",
  owner1Percent: 40,
  owner2Percent: 40,
  payrollPoolPercent: 20,
  owner1VolunteerWeekday: 0,
  owner2VolunteerWeekday: null,
};

export function validateOwnerProfitSplit(settings: OwnerProfitSplitSettings) {
  const total =
    settings.owner1Percent + settings.owner2Percent + settings.payrollPoolPercent;
  if (total !== 100) {
    return `Percents must add up to 100% (currently ${total}%).`;
  }
  if (
    settings.owner1Percent < 0 ||
    settings.owner2Percent < 0 ||
    settings.payrollPoolPercent < 0
  ) {
    return "Percents cannot be negative.";
  }
  return null;
}

export type ProfitSplitAllocation = {
  owner1Cents: number;
  owner2Cents: number;
  payrollPoolCents: number;
};

/** Split any amount (e.g. wages on shared days) by owner / shop pool %. */
export function allocateAmountBySplit(
  amountCents: number,
  settings: OwnerProfitSplitSettings,
): ProfitSplitAllocation {
  return allocateGrossProfit(amountCents, settings);
}

export function allocateGrossProfit(
  netIncomeCents: number,
  settings: OwnerProfitSplitSettings,
): ProfitSplitAllocation {
  if (netIncomeCents <= 0) {
    return { owner1Cents: 0, owner2Cents: 0, payrollPoolCents: 0 };
  }

  let owner1Cents = Math.round((netIncomeCents * settings.owner1Percent) / 100);
  let owner2Cents = Math.round((netIncomeCents * settings.owner2Percent) / 100);
  let payrollPoolCents = Math.round(
    (netIncomeCents * settings.payrollPoolPercent) / 100,
  );

  const allocated = owner1Cents + owner2Cents + payrollPoolCents;
  const remainder = netIncomeCents - allocated;
  if (remainder !== 0) {
    payrollPoolCents += remainder;
  }

  return { owner1Cents, owner2Cents, payrollPoolCents };
}

export type StaffPayLine = {
  userId: number;
  employeeName: string;
  hoursOwedCents: number;
  suggestedPayCents: number;
  coveredPercent: number;
};

export function suggestStaffPayFromPool(
  staffLines: Array<{ userId: number; employeeName: string; hoursOwedCents: number }>,
  payrollPoolCents: number,
): StaffPayLine[] {
  const totalOwed = staffLines.reduce((sum, line) => sum + line.hoursOwedCents, 0);
  if (totalOwed <= 0 || staffLines.length === 0) {
    return staffLines.map((line) => ({
      ...line,
      suggestedPayCents: 0,
      coveredPercent: 0,
    }));
  }

  if (payrollPoolCents >= totalOwed) {
    return staffLines.map((line) => ({
      ...line,
      suggestedPayCents: line.hoursOwedCents,
      coveredPercent: 100,
    }));
  }

  const scale = payrollPoolCents / totalOwed;
  const coveredPercent = Math.round(scale * 1000) / 10;

  return staffLines.map((line) => ({
    ...line,
    suggestedPayCents: Math.round(line.hoursOwedCents * scale),
    coveredPercent,
  }));
}

export type OwnerPayrollPlanScope = {
  label: string;
  profit: MonthlyNetIncome;
  allocation: ProfitSplitAllocation;
  staffOwedCents: number;
  staffSuggestedTotalCents: number;
  poolSurplusCents: number;
  staffLines: StaffPayLine[];
};

export function buildOwnerPayrollPlan(
  scopeLabel: string,
  profit: MonthlyNetIncome,
  settings: OwnerProfitSplitSettings,
  staffLines: Array<{ userId: number; employeeName: string; hoursOwedCents: number }>,
): OwnerPayrollPlanScope {
  const allocation = allocateGrossProfit(profit.netIncomeCents, settings);
  const staff = suggestStaffPayFromPool(staffLines, allocation.payrollPoolCents);
  const staffOwedCents = staffLines.reduce((sum, line) => sum + line.hoursOwedCents, 0);
  const staffSuggestedTotalCents = staff.reduce(
    (sum, line) => sum + line.suggestedPayCents,
    0,
  );

  return {
    label: scopeLabel,
    profit,
    allocation,
    staffOwedCents,
    staffSuggestedTotalCents,
    poolSurplusCents: allocation.payrollPoolCents - staffSuggestedTotalCents,
    staffLines: staff,
  };
}

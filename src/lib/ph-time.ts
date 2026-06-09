/** Philippines (Asia/Manila) calendar helpers for sales & investor month boundaries. */

export const PH_TIMEZONE = "Asia/Manila";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Inclusive start / exclusive end for a calendar month in PH time. */
export function phMonthBounds(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: new Date(`${year}-${pad2(month)}-01T00:00:00+08:00`),
    end: new Date(`${nextYear}-${pad2(nextMonth)}-01T00:00:00+08:00`),
  };
}

export function phCalendarParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
  };
}

export function phNow() {
  return phCalendarParts(new Date());
}

export function phMonthKey(date: Date) {
  const { year, month } = phCalendarParts(date);
  return `${year}-${month}` as `${number}-${number}`;
}

export function phIsCurrentMonth(year: number, month: number) {
  const now = phNow();
  return year === now.year && month === now.month;
}

export function phMonthLabel(year: number, month: number) {
  return new Date(`${year}-${pad2(month)}-15T12:00:00+08:00`).toLocaleDateString(
    "en-PH",
    { month: "long", year: "numeric", timeZone: PH_TIMEZONE },
  );
}

/** Start of today in Philippines time. */
export function phStartOfToday() {
  const { year, month, day } = phNow();
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T00:00:00+08:00`);
}

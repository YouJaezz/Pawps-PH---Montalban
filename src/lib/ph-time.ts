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

/** Inclusive start / exclusive end for a calendar day in PH time. */
export function phDayBounds(year: number, month: number, day: number) {
  const nextYear = month === 12 && day === 31 ? year + 1 : year;
  const nextMonth =
    day === phDaysInMonth(year, month) ? (month === 12 ? 1 : month + 1) : month;
  const nextDay = day === phDaysInMonth(year, month) ? 1 : day + 1;
  return {
    start: new Date(`${year}-${pad2(month)}-${pad2(day)}T00:00:00+08:00`),
    end: new Date(`${nextYear}-${pad2(nextMonth)}-${pad2(nextDay)}T00:00:00+08:00`),
  };
}

export function phDaysInMonth(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const last = new Date(`${nextYear}-${pad2(nextMonth)}-01T00:00:00+08:00`);
  last.setTime(last.getTime() - 86_400_000);
  return phCalendarParts(last).day;
}

export function phDayLabel(year: number, month: number, day: number) {
  return new Date(
    `${year}-${pad2(month)}-${pad2(day)}T12:00:00+08:00`,
  ).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: PH_TIMEZONE,
  });
}

/** Whole calendar days from `from` (inclusive) to `to` (exclusive anchor day). */
export function phDaysBetween(from: Date, toDayStart: Date) {
  const fromDay = phCalendarParts(from);
  const toDay = phCalendarParts(toDayStart);
  const fromMs = new Date(
    `${fromDay.year}-${pad2(fromDay.month)}-${pad2(fromDay.day)}T12:00:00+08:00`,
  ).getTime();
  const toMs = new Date(
    `${toDay.year}-${pad2(toDay.month)}-${pad2(toDay.day)}T12:00:00+08:00`,
  ).getTime();
  return Math.max(0, Math.round((toMs - fromMs) / 86_400_000));
}

export function resolvePhDateParams(
  dateParam?: string,
  yearParam?: string,
  monthParam?: string,
  dayParam?: string,
) {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split("-").map(Number);
    if (y && m && d) return { year: y, month: m, day: d };
  }
  const now = phNow();
  const year = yearParam ? Number(yearParam) : now.year;
  const month = monthParam ? Number(monthParam) : now.month;
  const day = dayParam ? Number(dayParam) : now.day;
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return now;
  }
  return { year, month, day };
}

export function phTodayDateKey() {
  const { year, month, day } = phNow();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Start of today in Philippines time. */
export function phStartOfToday() {
  const { year, month, day } = phNow();
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T00:00:00+08:00`);
}

/** PH wall-clock time on a calendar day (e.g. daily attendance cutoff). */
export function phDateTimeAt(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return new Date(
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00+08:00`,
  );
}

export function formatPhTime(hour: number, minute: number) {
  const d = phDateTimeAt(2000, 1, 1, hour, minute);
  return d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PH_TIMEZONE,
  });
}

export function toPhDatetimeLocalValue(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

export function parsePhDatetimeLocal(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  return phDateTimeAt(
    Number(y),
    Number(m),
    Number(d),
    Number(hh),
    Number(mm),
  );
}

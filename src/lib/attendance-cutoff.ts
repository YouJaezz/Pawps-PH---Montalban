import {
  formatPhTime,
  phCalendarParts,
  phDateTimeAt,
  phDayBounds,
  PH_TIMEZONE,
} from "@/lib/ph-time";

export type AttendanceCutoffSettings = {
  autoCutoffEnabled: boolean;
  cutoffHour: number;
  cutoffMinute: number;
};

export function cutoffDateTimeForDay(
  settings: Pick<AttendanceCutoffSettings, "cutoffHour" | "cutoffMinute">,
  year: number,
  month: number,
  day: number,
) {
  return phDateTimeAt(year, month, day, settings.cutoffHour, settings.cutoffMinute);
}

export function todayCutoffDateTime(
  settings: Pick<AttendanceCutoffSettings, "cutoffHour" | "cutoffMinute">,
  now = new Date(),
) {
  const { year, month, day } = phCalendarParts(now);
  return cutoffDateTimeForDay(settings, year, month, day);
}

export function isStaffAttendanceLocked(
  settings: AttendanceCutoffSettings,
  now = new Date(),
) {
  if (!settings.autoCutoffEnabled) return false;
  return now.getTime() >= todayCutoffDateTime(settings, now).getTime();
}

export function formatCutoffLabel(
  settings: Pick<AttendanceCutoffSettings, "cutoffHour" | "cutoffMinute">,
) {
  return formatPhTime(settings.cutoffHour, settings.cutoffMinute);
}

export function parseCutoffTimeInput(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function cutoffTimeInputValue(
  settings: Pick<AttendanceCutoffSettings, "cutoffHour" | "cutoffMinute">,
) {
  return `${String(settings.cutoffHour).padStart(2, "0")}:${String(settings.cutoffMinute).padStart(2, "0")}`;
}

export function nextAttendanceUnlockLabel(now = new Date()) {
  const { year, month, day } = phCalendarParts(now);
  const { end } = phDayBounds(year, month, day);
  return end.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: PH_TIMEZONE,
  });
}

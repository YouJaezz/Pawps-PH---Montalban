/** Pure time math helpers — safe for client and server. */

export function entryMinutes(clockIn: Date, clockOut: Date | null) {
  if (!clockOut) return 0;
  return Math.max(
    0,
    Math.round((clockOut.getTime() - clockIn.getTime()) / 60_000),
  );
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

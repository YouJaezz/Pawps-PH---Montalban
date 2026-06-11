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

/** Elapsed ms → HH:MM:SS or MM:SS for live shift timers. */
export function formatLiveDuration(elapsedMs: number) {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

export function liveElapsedMs(clockInAt: Date | string) {
  return Math.max(0, Date.now() - new Date(clockInAt).getTime());
}

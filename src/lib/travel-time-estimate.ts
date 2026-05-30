/** Typical PH urban/suburban traffic vs OSRM free-flow time. */
export const DEFAULT_TRAFFIC_FACTOR = 1.35;

/** Average pause at intersections / stop lights (seconds). */
export const DEFAULT_STOP_LIGHT_PAUSE_SEC = 45;

const INTERSECTION_MANEUVER_TYPES = new Set([
  "turn",
  "merge",
  "fork",
  "on ramp",
  "off ramp",
  "end of road",
  "roundabout",
  "rotary",
  "exit roundabout",
]);

export type TravelTimeEstimate = {
  baseDriveMinutes: number;
  trafficBufferMinutes: number;
  stopLightMinutes: number;
  intersectionCount: number;
  totalEstimatedMinutes: number;
  trafficFactor: number;
  stopLightPauseSec: number;
};

export function countRouteIntersections(
  steps: { maneuver?: { type?: string } }[] | undefined,
): number {
  if (!steps?.length) return 0;
  return steps.filter((step) => {
    const type = step.maneuver?.type?.toLowerCase() ?? "";
    return INTERSECTION_MANEUVER_TYPES.has(type);
  }).length;
}

export function estimateTravelTime(
  baseDurationSeconds: number,
  intersectionCount: number,
  options?: {
    trafficFactor?: number;
    stopLightPauseSec?: number;
  },
): TravelTimeEstimate {
  const trafficFactor = options?.trafficFactor ?? DEFAULT_TRAFFIC_FACTOR;
  const stopLightPauseSec =
    options?.stopLightPauseSec ?? DEFAULT_STOP_LIGHT_PAUSE_SEC;

  const baseDriveMinutes = Math.max(1, Math.round(baseDurationSeconds / 60));
  const withTrafficSeconds = baseDurationSeconds * trafficFactor;
  const trafficBufferMinutes = Math.max(
    0,
    Math.round((withTrafficSeconds - baseDurationSeconds) / 60),
  );
  const stopLightMinutes = Math.round(
    (intersectionCount * stopLightPauseSec) / 60,
  );
  const totalEstimatedMinutes = Math.max(
    1,
    Math.round(withTrafficSeconds / 60) + stopLightMinutes,
  );

  return {
    baseDriveMinutes,
    trafficBufferMinutes,
    stopLightMinutes,
    intersectionCount,
    totalEstimatedMinutes,
    trafficFactor,
    stopLightPauseSec,
  };
}

export function formatDurationMinutes(minutes: number) {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

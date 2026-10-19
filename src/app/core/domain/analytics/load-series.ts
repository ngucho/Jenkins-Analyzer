import { DAY, HOUR, MINUTE, TimeWindow, windowDuration } from '../time-window';

/** Charge sur un intervalle : nombre moyen et maximal de builds simultanés. */
export interface LoadPoint extends TimeWindow {
  readonly averageLoad: number;
  readonly peakLoad: number;
}

const BUCKET_SIZES = [
  MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
];

/** Choisit une taille de bucket « ronde » pour obtenir environ `targetPoints` points. */
export function pickBucketSize(window: TimeWindow, targetPoints = 200): number {
  const ideal = windowDuration(window) / targetPoints;
  return BUCKET_SIZES.find((size) => size >= ideal) ?? BUCKET_SIZES[BUCKET_SIZES.length - 1];
}

/**
 * Découpe la fenêtre en buckets et calcule la charge de chacun par balayage
 * des débuts/fins de builds (O(n log n)).
 */
export function computeLoadSeries(
  intervals: readonly TimeWindow[],
  window: TimeWindow,
  bucketSize: number,
): LoadPoint[] {
  if (bucketSize <= 0 || windowDuration(window) === 0) return [];

  // À instant égal, les fins passent avant les débuts : deux builds
  // enchaînés ne comptent pas comme simultanés.
  const events = intervals
    .flatMap((i) => [
      { time: i.start, delta: 1 },
      { time: i.end, delta: -1 },
    ])
    .sort((a, b) => a.time - b.time || a.delta - b.delta);

  const points: LoadPoint[] = [];
  let running = 0;
  let next = 0;

  for (let start = window.start; start < window.end; start += bucketSize) {
    const end = Math.min(start + bucketSize, window.end);
    // Les événements pile au début du bucket s'appliquent avant de mesurer le pic.
    while (next < events.length && events[next].time <= start) {
      running += events[next++].delta;
    }
    let peak = running;
    let area = 0;
    let lastTime = start;

    while (next < events.length && events[next].time < end) {
      const event = events[next++];
      area += running * (event.time - lastTime);
      lastTime = event.time;
      running += event.delta;
      peak = Math.max(peak, running);
    }
    area += running * (end - lastTime);

    points.push({ start, end, averageLoad: area / (end - start), peakLoad: peak });
  }
  return points;
}

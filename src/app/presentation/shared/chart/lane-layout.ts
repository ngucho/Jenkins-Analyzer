import { TimeWindow } from '@domain/time-window';

/**
 * Range des intervalles sur le moins de lignes possible sans chevauchement
 * (algorithme glouton : le nombre de lignes égale le pic de concurrence).
 */
export function packLanes<T extends TimeWindow>(items: readonly T[]): T[][] {
  const lanes: T[][] = [];
  const laneEnds: number[] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const free = laneEnds.findIndex((end) => end <= item.start);
    if (free === -1) {
      lanes.push([item]);
      laneEnds.push(item.end);
    } else {
      lanes[free].push(item);
      laneEnds[free] = item.end;
    }
  }
  return lanes;
}

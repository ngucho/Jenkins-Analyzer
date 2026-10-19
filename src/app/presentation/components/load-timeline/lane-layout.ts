import { Build } from '@domain/build';

/**
 * Range les builds sur le moins de lignes possible sans chevauchement
 * (algorithme glouton : le nombre de lignes égale le pic de concurrence).
 */
export function packLanes(builds: readonly Build[]): Build[][] {
  const lanes: Build[][] = [];
  const laneEnds: number[] = [];
  for (const build of [...builds].sort((a, b) => a.start - b.start)) {
    const free = laneEnds.findIndex((end) => end <= build.start);
    if (free === -1) {
      lanes.push([build]);
      laneEnds.push(build.end);
    } else {
      lanes[free].push(build);
      laneEnds[free] = build.end;
    }
  }
  return lanes;
}

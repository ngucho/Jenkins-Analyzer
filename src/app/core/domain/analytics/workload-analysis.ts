import { Build, isFinished } from '../build';
import { clipToWindow, overlaps, TimeWindow, windowDuration } from '../time-window';
import { computeJobStats, JobStats } from './job-stats';
import { computeLoadSeries } from './load-series';
import { busyTime, findIdleSlots, IdleSlot } from './occupancy';

export interface WorkloadSummary {
  readonly buildCount: number;
  readonly jobCount: number;
  /** Temps pendant lequel au moins un build tourne. */
  readonly busyTime: number;
  /** Temps sans aucun build. */
  readonly idleTime: number;
  readonly occupancyRate: number;
  /** Somme des durées de builds (temps machine), bornée à la fenêtre. */
  readonly cumulatedBuildTime: number;
  readonly peakConcurrency: number;
  readonly failureRate: number | null;
  readonly longestIdleSlot: IdleSlot | null;
}

export interface WorkloadAnalysis {
  readonly summary: WorkloadSummary;
  readonly idleSlots: readonly IdleSlot[];
  readonly jobStats: readonly JobStats[];
}

export interface AnalysisOptions {
  readonly idleThreshold: number;
}

const EMPTY: TimeWindow = { start: 0, end: 0 };

export function analyzeWorkload(
  allBuilds: readonly Build[],
  window: TimeWindow,
  options: AnalysisOptions,
): WorkloadAnalysis {
  const builds = allBuilds.filter((build) => overlaps(build, window));
  const idleSlots = findIdleSlots(builds, window, options.idleThreshold);
  const busy = busyTime(builds, window);
  const finished = builds.filter(isFinished);
  const failed = finished.filter((b) => b.result === 'FAILURE' || b.result === 'UNSTABLE');

  const summary: WorkloadSummary = {
    buildCount: builds.length,
    jobCount: new Set(builds.map((build) => build.jobName)).size,
    busyTime: busy,
    idleTime: windowDuration(window) - busy,
    occupancyRate: windowDuration(window) > 0 ? busy / windowDuration(window) : 0,
    cumulatedBuildTime: builds.reduce(
      (sum, build) => sum + windowDuration(clipToWindow(build, window) ?? EMPTY),
      0,
    ),
    peakConcurrency: Math.max(
      0,
      ...computeLoadSeries(builds, window, windowDuration(window)).map((p) => p.peakLoad),
    ),
    failureRate: finished.length > 0 ? failed.length / finished.length : null,
    longestIdleSlot: idleSlots.reduce<IdleSlot | null>(
      (longest, slot) => (!longest || slot.duration > longest.duration ? slot : longest),
      null,
    ),
  };

  return { summary, idleSlots, jobStats: computeJobStats(builds) };
}

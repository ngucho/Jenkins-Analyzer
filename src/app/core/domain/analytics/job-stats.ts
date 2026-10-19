import { Build, buildDuration, isFinished } from '../build';

export interface JobStats {
  readonly jobName: string;
  readonly runs: number;
  readonly totalDuration: number;
  readonly averageDuration: number;
  readonly maxDuration: number;
  /** Part des builds terminés en succès ; `null` si aucun n'est terminé. */
  readonly successRate: number | null;
  /** Part du temps machine cumulé consommée par ce job. */
  readonly shareOfBuildTime: number;
  readonly lastStart: number;
}

/** Statistiques par job, triées du plus consommateur au moins consommateur. */
export function computeJobStats(builds: readonly Build[]): JobStats[] {
  const byJob = new Map<string, Build[]>();
  for (const build of builds) {
    const jobBuilds = byJob.get(build.jobName);
    if (jobBuilds) jobBuilds.push(build);
    else byJob.set(build.jobName, [build]);
  }
  const totalBuildTime = builds.reduce((sum, build) => sum + buildDuration(build), 0);

  return [...byJob.entries()]
    .map(([jobName, jobBuilds]) => {
      const durations = jobBuilds.map(buildDuration);
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const finished = jobBuilds.filter(isFinished);
      const succeeded = finished.filter((build) => build.result === 'SUCCESS').length;
      return {
        jobName,
        runs: jobBuilds.length,
        totalDuration,
        averageDuration: totalDuration / jobBuilds.length,
        maxDuration: Math.max(...durations),
        successRate: finished.length > 0 ? succeeded / finished.length : null,
        shareOfBuildTime: totalBuildTime > 0 ? totalDuration / totalBuildTime : 0,
        lastStart: Math.max(...jobBuilds.map((build) => build.start)),
      };
    })
    .sort((a, b) => b.totalDuration - a.totalDuration);
}

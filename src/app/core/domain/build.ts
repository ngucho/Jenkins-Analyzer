import { TimeWindow } from './time-window';

export type BuildResult =
  | 'SUCCESS'
  | 'FAILURE'
  | 'UNSTABLE'
  | 'ABORTED'
  | 'NOT_BUILT'
  | 'RUNNING'
  | 'UNKNOWN';

/** Ce qui a déclenché un build : planification, commit, utilisateur, autre job… */
export type BuildTrigger = 'timer' | 'scm' | 'user' | 'upstream' | 'other' | 'unknown';

/** Une exécution de job, ramenée à ce qui compte pour l'analyse de charge. */
export interface Build extends TimeWindow {
  readonly id: string;
  readonly jobName: string;
  readonly number: number;
  readonly result: BuildResult;
  /** Agent qui a exécuté le build, si Jenkins l'expose. */
  readonly node: string | null;
  readonly trigger: BuildTrigger;
  readonly url: string;
}

export function buildDuration(build: Build): number {
  return build.end - build.start;
}

export function isFinished(build: Build): boolean {
  return build.result !== 'RUNNING';
}

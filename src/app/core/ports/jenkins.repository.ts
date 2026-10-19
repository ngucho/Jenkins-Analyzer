import { Observable } from 'rxjs';
import { AgentNode } from '@domain/agent-node';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { JenkinsJob } from '@domain/job';
import { TimeWindow } from '@domain/time-window';
import { WorkloadSnapshot } from '@domain/workload-snapshot';

export interface ConnectionReport {
  readonly version: string | null;
  readonly jobCount: number;
  readonly nodes: readonly AgentNode[];
}

/** Planifications (cron) déclarées dans Jenkins. */
export interface ScheduleReport {
  /** Expressions cron par nom de job ; seuls les jobs planifiés y figurent. */
  readonly specs: ReadonlyMap<string, readonly string[]>;
  /** Jobs dont la configuration n'a pas pu être lue (droits, erreur…). */
  readonly unreadableJobs: readonly string[];
}

/** Un chargement long émet sa progression, puis son résultat. */
export type FetchEvent<T> =
  | { readonly type: 'progress'; readonly completed: number; readonly total: number }
  | { readonly type: 'complete'; readonly result: T };

export type WorkloadFetchEvent = FetchEvent<WorkloadSnapshot>;
export type ScheduleFetchEvent = FetchEvent<ScheduleReport>;

/** Port d'accès aux données Jenkins. Les erreurs émises sont des `JenkinsError`. */
export abstract class JenkinsRepository {
  abstract checkConnection(settings: JenkinsSettings): Observable<ConnectionReport>;

  abstract fetchWorkload(
    settings: JenkinsSettings,
    window: TimeWindow,
  ): Observable<WorkloadFetchEvent>;

  abstract fetchSchedules(
    settings: JenkinsSettings,
    jobs: readonly JenkinsJob[],
  ): Observable<ScheduleFetchEvent>;
}

import { Observable } from 'rxjs';
import { AgentNode } from '@domain/agent-node';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { TimeWindow } from '@domain/time-window';
import { WorkloadSnapshot } from '@domain/workload-snapshot';

export interface ConnectionReport {
  readonly version: string | null;
  readonly jobCount: number;
  readonly nodes: readonly AgentNode[];
}

export type WorkloadFetchEvent =
  | { readonly type: 'progress'; readonly completed: number; readonly total: number }
  | { readonly type: 'complete'; readonly snapshot: WorkloadSnapshot };

/** Port d'accès aux données Jenkins. Les erreurs émises sont des `JenkinsError`. */
export abstract class JenkinsRepository {
  abstract checkConnection(settings: JenkinsSettings): Observable<ConnectionReport>;

  abstract fetchWorkload(
    settings: JenkinsSettings,
    window: TimeWindow,
  ): Observable<WorkloadFetchEvent>;
}

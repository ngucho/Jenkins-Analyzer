import { inject, Injectable } from '@angular/core';
import {
  catchError,
  concat,
  defer,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import { AgentNode } from '@domain/agent-node';
import { JenkinsError } from '@domain/jenkins-error';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { overlaps, TimeWindow } from '@domain/time-window';
import { Build } from '@domain/build';
import { WorkloadSnapshot } from '@domain/workload-snapshot';
import { ConnectionReport, JenkinsRepository, WorkloadFetchEvent } from '@ports/jenkins.repository';
import { ComputerSetDto, JobBuildsDto, JobListDto } from './jenkins-api.types';
import { JenkinsHttpClient } from './jenkins-http.client';
import { DiscoveredJob, flattenJobTree, toAgentNode, toBuild } from './jenkins.mapper';

/** Profondeur d'exploration des dossiers (dossier > multibranch > branche…). */
const FOLDER_DEPTH = 5;
/** Nombre de requêtes d'historique envoyées en parallèle, pour ménager Jenkins. */
const PARALLEL_REQUESTS = 4;

const BUILD_FIELDS = 'number,timestamp,duration,estimatedDuration,result,building,builtOn,url';
const COMPUTER_TREE = 'computer[displayName,numExecutors,offline,idle]';

/** `jobs[name,url,_class,jobs[name,url,_class,…]]` sur `depth` niveaux. */
function jobTree(depth: number): string {
  const fields = 'name,url,_class';
  return depth === 0 ? `jobs[${fields}]` : `jobs[${fields},${jobTree(depth - 1)}]`;
}

interface JobHistory {
  readonly job: DiscoveredJob;
  readonly builds: readonly Build[];
  readonly truncated: boolean;
  readonly failed: boolean;
}

@Injectable({ providedIn: 'root' })
export class HttpJenkinsRepository extends JenkinsRepository {
  private readonly client = inject(JenkinsHttpClient);

  checkConnection(settings: JenkinsSettings): Observable<ConnectionReport> {
    return this.fetchInventory(settings).pipe(
      map(({ jobs, computers }) => ({
        version: jobs.version,
        jobCount: flattenJobTree(jobs.body.jobs ?? []).length,
        nodes: (computers.body.computer ?? []).map(toAgentNode),
      })),
    );
  }

  fetchWorkload(settings: JenkinsSettings, window: TimeWindow): Observable<WorkloadFetchEvent> {
    return this.fetchInventory(settings).pipe(
      switchMap(({ jobs, computers }) => {
        const discovered = flattenJobTree(jobs.body.jobs ?? []);
        const nodes = (computers.body.computer ?? []).map(toAgentNode);
        const histories: JobHistory[] = [];
        const progress = (): WorkloadFetchEvent => ({
          type: 'progress',
          completed: histories.length,
          total: discovered.length,
        });

        return concat(
          of(progress()),
          from(discovered).pipe(
            mergeMap((job) => this.fetchHistory(settings, job, window), PARALLEL_REQUESTS),
            map((history) => {
              histories.push(history);
              return progress();
            }),
          ),
          defer(() => of(toCompleteEvent(window, discovered, nodes, histories))),
        );
      }),
    );
  }

  /** Arborescence des jobs et nœuds : deux requêtes légères, en parallèle. */
  private fetchInventory(settings: JenkinsSettings) {
    return forkJoin({
      jobs: this.client.get<JobListDto>(settings, '', jobTree(FOLDER_DEPTH)),
      computers: this.client.get<ComputerSetDto>(settings, 'computer/', COMPUTER_TREE),
    });
  }

  private fetchHistory(
    settings: JenkinsSettings,
    job: DiscoveredJob,
    window: TimeWindow,
  ): Observable<JobHistory> {
    const limit = settings.maxBuildsPerJob;
    const tree = `builds[${BUILD_FIELDS}]{0,${limit}}`;
    const now = Date.now();
    return this.client.get<JobBuildsDto>(settings, job.apiPath, tree).pipe(
      map(({ body }) => {
        const dtos = body.builds ?? [];
        const builds = dtos
          .map((dto) => toBuild(dto, job.fullName, now))
          .filter((build) => overlaps(build, window));
        // Les builds arrivent du plus récent au plus ancien : si le plus ancien
        // reçu est encore dans la fenêtre, l'historique est incomplet.
        const oldest = dtos.at(-1);
        const truncated = dtos.length >= limit && !!oldest && oldest.timestamp > window.start;
        return { job, builds, truncated, failed: false };
      }),
      catchError((error: JenkinsError) =>
        error.kind === 'unauthorized' || error.kind === 'network'
          ? throwError(() => error)
          : of({ job, builds: [], truncated: false, failed: true }),
      ),
    );
  }
}

function toCompleteEvent(
  window: TimeWindow,
  discovered: readonly DiscoveredJob[],
  nodes: readonly AgentNode[],
  histories: readonly JobHistory[],
): WorkloadFetchEvent {
  const failedJobs = histories.filter((h) => h.failed).map((h) => h.job.fullName);
  if (discovered.length > 0 && failedJobs.length === discovered.length) {
    throw new JenkinsError('server', 'Aucun historique de job n’a pu être lu.');
  }
  const snapshot: WorkloadSnapshot = {
    window,
    jobs: discovered.map(({ fullName, url }) => ({ fullName, url })),
    builds: histories.flatMap((h) => h.builds),
    nodes,
    fetchedAt: Date.now(),
    truncatedJobs: histories.filter((h) => h.truncated).map((h) => h.job.fullName),
    failedJobs,
  };
  return { type: 'complete', snapshot };
}

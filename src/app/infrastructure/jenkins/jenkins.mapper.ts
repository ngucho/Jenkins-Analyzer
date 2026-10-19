import { AgentNode } from '@domain/agent-node';
import { Build, BuildResult } from '@domain/build';
import { BuildDto, ComputerDto, JobItemDto } from './jenkins-api.types';

const KNOWN_RESULTS: readonly BuildResult[] = [
  'SUCCESS',
  'FAILURE',
  'UNSTABLE',
  'ABORTED',
  'NOT_BUILT',
];

/** Un job « feuille » découvert dans l'arborescence, avec son chemin d'API relatif. */
export interface DiscoveredJob {
  readonly fullName: string;
  readonly apiPath: string;
  readonly url: string;
}

/** Aplatit l'arborescence dossiers / multibranch en liste de jobs exécutables. */
export function flattenJobTree(
  items: readonly JobItemDto[],
  parentName = '',
  parentPath = '',
): DiscoveredJob[] {
  return items.flatMap((item) => {
    const fullName = parentName ? `${parentName}/${item.name}` : item.name;
    const apiPath = `${parentPath}job/${encodeURIComponent(item.name)}/`;
    return item.jobs
      ? flattenJobTree(item.jobs, fullName, apiPath)
      : [{ fullName, apiPath, url: item.url }];
  });
}

export function toBuild(dto: BuildDto, jobName: string, now: number): Build {
  const result: BuildResult = dto.building
    ? 'RUNNING'
    : (KNOWN_RESULTS.find((r) => r === dto.result) ?? 'UNKNOWN');
  // Un build en cours a une durée de 0 côté Jenkins : il court jusqu'à maintenant.
  const end = dto.building ? Math.max(now, dto.timestamp) : dto.timestamp + dto.duration;
  return {
    id: `${jobName}#${dto.number}`,
    jobName,
    number: dto.number,
    start: dto.timestamp,
    end,
    result,
    node: dto.builtOn === undefined ? null : dto.builtOn || 'built-in',
    url: dto.url,
  };
}

export function toAgentNode(dto: ComputerDto): AgentNode {
  return {
    name: dto.displayName,
    executors: dto.numExecutors,
    online: !dto.offline,
    idle: dto.idle,
  };
}

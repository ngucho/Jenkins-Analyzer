import { AgentNode } from './agent-node';
import { Build } from './build';
import { JenkinsJob } from './job';
import { TimeWindow } from './time-window';

/** Photographie de l'activité Jenkins sur une période donnée. */
export interface WorkloadSnapshot {
  readonly window: TimeWindow;
  readonly jobs: readonly JenkinsJob[];
  readonly builds: readonly Build[];
  readonly nodes: readonly AgentNode[];
  readonly fetchedAt: number;
  /** Jobs dont l'historique a été tronqué par la limite de builds par job. */
  readonly truncatedJobs: readonly string[];
  /** Jobs dont l'historique n'a pas pu être lu. */
  readonly failedJobs: readonly string[];
}

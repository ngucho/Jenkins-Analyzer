/** Un nœud Jenkins (contrôleur ou agent) et sa capacité d'exécution. */
export interface AgentNode {
  readonly name: string;
  readonly executors: number;
  readonly online: boolean;
  readonly idle: boolean;
}

export function onlineExecutors(nodes: readonly AgentNode[]): number {
  return nodes.filter((node) => node.online).reduce((sum, node) => sum + node.executors, 0);
}

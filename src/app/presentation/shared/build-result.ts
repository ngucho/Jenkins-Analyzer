import { BuildResult } from '@domain/build';

export const RESULT_LABELS: Record<BuildResult, string> = {
  SUCCESS: 'Succès',
  FAILURE: 'Échec',
  UNSTABLE: 'Instable',
  ABORTED: 'Annulé',
  NOT_BUILT: 'Non construit',
  RUNNING: 'En cours',
  UNKNOWN: 'Inconnu',
};

/** Classe CSS associée au résultat (voir les tokens `--result-*`). */
export function resultClass(result: BuildResult): string {
  return `result-${result.toLowerCase().replace('_', '-')}`;
}

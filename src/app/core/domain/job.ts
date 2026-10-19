export interface JenkinsJob {
  /** Nom complet, dossiers inclus (ex. `backend/api-build`). */
  readonly fullName: string;
  readonly url: string;
  /** Identifiant opaque, propre à la source de données, pour relire ce job. */
  readonly ref: string;
}

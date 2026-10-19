export interface JenkinsJob {
  /** Nom complet, dossiers inclus (ex. `backend/api-build`). */
  readonly fullName: string;
  readonly url: string;
}

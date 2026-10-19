export type JenkinsErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'timeout'
  | 'server'
  | 'invalid-response';

/** Erreur d'accès à Jenkins, avec un message prêt à afficher. */
export class JenkinsError extends Error {
  constructor(
    readonly kind: JenkinsErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'JenkinsError';
  }
}

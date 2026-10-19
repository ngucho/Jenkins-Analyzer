import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  map,
  MonoTypeOperatorFunction,
  Observable,
  retry,
  throwError,
  timeout,
  TimeoutError,
  timer,
} from 'rxjs';
import { JenkinsError } from '@domain/jenkins-error';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { SECOND } from '@domain/time-window';

/** Préfixe servi par le proxy du serveur de dev (voir `proxy.conf.mjs`). */
export const DEV_PROXY_PREFIX = '/jenkins-proxy';

const REQUEST_TIMEOUT = 30 * SECOND;
const MAX_RETRIES = 2;
const TRANSIENT_STATUSES = new Set([0, 429, 502, 503, 504]);

export interface JenkinsResponse<T> {
  readonly body: T;
  readonly version: string | null;
}

/**
 * Client HTTP bas niveau : construit l'URL, ajoute l'authentification,
 * applique timeout et retries, et traduit les erreurs en `JenkinsError`.
 */
@Injectable({ providedIn: 'root' })
export class JenkinsHttpClient {
  private readonly http = inject(HttpClient);

  get<T>(settings: JenkinsSettings, path: string, tree?: string): Observable<JenkinsResponse<T>> {
    const params = tree ? new HttpParams().set('tree', tree) : undefined;
    return this.http
      .get<T>(`${baseUrlOf(settings)}/${path}api/json`, {
        headers: authHeaders(settings, 'application/json'),
        params,
        observe: 'response',
      })
      .pipe(
        resilient(),
        map((response) => {
          if (response.body === null) {
            throw new JenkinsError('invalid-response', 'Réponse vide de Jenkins.');
          }
          return { body: response.body, version: response.headers.get('X-Jenkins') };
        }),
        catchError((error: unknown) => throwError(() => toJenkinsError(error))),
      );
  }

  /** Lit un fichier texte de Jenkins (ex. `job/x/config.xml`). */
  getText(settings: JenkinsSettings, path: string): Observable<string> {
    return this.http
      .get(`${baseUrlOf(settings)}/${path}`, {
        headers: authHeaders(settings, 'application/xml, text/plain'),
        responseType: 'text',
      })
      .pipe(
        resilient(),
        catchError((error: unknown) => throwError(() => toJenkinsError(error))),
      );
  }
}

/** Timeout et nouvelles tentatives sur erreur passagère, communs à toutes les requêtes. */
function resilient<T>(): MonoTypeOperatorFunction<T> {
  return (source) =>
    source.pipe(timeout(REQUEST_TIMEOUT), retry({ count: MAX_RETRIES, delay: retryDelay }));
}

function baseUrlOf(settings: JenkinsSettings): string {
  return settings.useDevProxy ? DEV_PROXY_PREFIX : settings.baseUrl.trim().replace(/\/+$/, '');
}

function authHeaders(settings: JenkinsSettings, accept: string): HttpHeaders {
  const credentials = btoa(`${settings.username.trim()}:${settings.apiToken.trim()}`);
  return new HttpHeaders({ Authorization: `Basic ${credentials}`, Accept: accept });
}

function retryDelay(error: unknown, attempt: number): Observable<number> {
  const transient = error instanceof HttpErrorResponse && TRANSIENT_STATUSES.has(error.status);
  return transient ? timer(500 * 2 ** attempt) : throwError(() => error);
}

function toJenkinsError(error: unknown): JenkinsError {
  if (error instanceof JenkinsError) return error;
  if (error instanceof TimeoutError) {
    return new JenkinsError('timeout', 'Jenkins met trop de temps à répondre.');
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new JenkinsError('invalid-response', 'Réponse inattendue de Jenkins.');
  }
  switch (error.status) {
    case 0:
      return new JenkinsError(
        'network',
        'Jenkins est injoignable : vérifiez l’URL, le réseau ou la configuration CORS (ou activez le proxy de dev).',
      );
    case 401:
      return new JenkinsError('unauthorized', 'Identifiants refusés : vérifiez l’utilisateur et le token API.');
    case 403:
      return new JenkinsError('forbidden', 'Accès refusé : l’utilisateur n’a pas la permission de lecture.');
    case 404:
      return new JenkinsError('not-found', 'Ressource introuvable : vérifiez l’URL de Jenkins.');
    case 200:
      return new JenkinsError(
        'invalid-response',
        'La réponse n’est pas du JSON : l’URL pointe-t-elle bien vers Jenkins ?',
      );
    default:
      return new JenkinsError('server', `Erreur Jenkins (HTTP ${error.status}).`);
  }
}

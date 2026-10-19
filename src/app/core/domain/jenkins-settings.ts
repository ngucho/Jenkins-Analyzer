export type DataSource = 'jenkins' | 'demo';

export interface JenkinsSettings {
  readonly dataSource: DataSource;
  readonly baseUrl: string;
  readonly username: string;
  readonly apiToken: string;
  /** Passe par le proxy du serveur de dev Angular pour contourner CORS. */
  readonly useDevProxy: boolean;
  readonly maxBuildsPerJob: number;
  /** Durée minimale (minutes) pour qu'un trou d'activité compte comme plage creuse. */
  readonly idleThresholdMinutes: number;
  /** Durée (heures) de la fenêtre de maintenance recherchée. */
  readonly maintenanceDurationHours: number;
}

export const DEFAULT_SETTINGS: JenkinsSettings = {
  dataSource: 'demo',
  baseUrl: '',
  username: '',
  apiToken: '',
  useDevProxy: false,
  maxBuildsPerJob: 300,
  idleThresholdMinutes: 30,
  maintenanceDurationHours: 2,
};

export function isConfigured(settings: JenkinsSettings): boolean {
  if (settings.dataSource === 'demo') return true;
  return [settings.baseUrl, settings.username, settings.apiToken].every((v) => v.trim() !== '');
}

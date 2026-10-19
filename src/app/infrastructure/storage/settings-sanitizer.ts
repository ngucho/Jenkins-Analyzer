import { DEFAULT_SETTINGS, JenkinsSettings } from '@domain/jenkins-settings';

/**
 * Ne garde que les champs connus, du bon type : un fichier modifié à la main
 * ou une ancienne version ne doit pas casser l'application.
 */
export function sanitizeSettings(raw: unknown): Partial<JenkinsSettings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    const value = source[key];
    if (value !== undefined && typeof value === typeof defaultValue) result[key] = value;
  }
  if (result['dataSource'] !== undefined && !['jenkins', 'demo'].includes(result['dataSource'] as string)) {
    delete result['dataSource'];
  }
  return result as Partial<JenkinsSettings>;
}

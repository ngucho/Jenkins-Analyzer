import { Injectable } from '@angular/core';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { SettingsRepository } from '@ports/settings.repository';
import { sanitizeSettings } from './settings-sanitizer';

const STORAGE_KEY = 'jenkins-workload.settings';

/** Persiste la configuration dans le navigateur (le token reste local au poste). */
@Injectable()
export class LocalStorageSettingsRepository extends SettingsRepository {
  loadStored(): Partial<JenkinsSettings> | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? sanitizeSettings(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  }

  save(settings: JenkinsSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Stockage indisponible (navigation privée…) : la config reste en mémoire.
    }
  }
}

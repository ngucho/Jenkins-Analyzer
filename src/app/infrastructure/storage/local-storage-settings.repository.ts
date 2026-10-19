import { Injectable } from '@angular/core';
import { DEFAULT_SETTINGS, JenkinsSettings } from '@domain/jenkins-settings';
import { SettingsRepository } from '@ports/settings.repository';

const STORAGE_KEY = 'jenkins-workload.settings';

/** Persiste la configuration dans le navigateur (le token reste local au poste). */
@Injectable()
export class LocalStorageSettingsRepository extends SettingsRepository {
  load(): JenkinsSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<JenkinsSettings>) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
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

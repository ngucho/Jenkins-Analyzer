import { computed, inject, Injectable, signal } from '@angular/core';
import { isConfigured, JenkinsSettings } from '@domain/jenkins-settings';
import { SettingsRepository } from '@ports/settings.repository';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly repository = inject(SettingsRepository);
  private readonly current = signal<JenkinsSettings>(this.repository.load());

  readonly settings = this.current.asReadonly();
  readonly isConfigured = computed(() => isConfigured(this.current()));
  /** Libellé court de la source de données, pour l'en-tête. */
  readonly sourceLabel = computed(() => {
    const settings = this.current();
    if (settings.dataSource === 'demo') return 'Données de démo';
    try {
      return new URL(settings.baseUrl).host;
    } catch {
      return settings.baseUrl;
    }
  });

  save(settings: JenkinsSettings): void {
    this.repository.save(settings);
    this.current.set(settings);
  }
}

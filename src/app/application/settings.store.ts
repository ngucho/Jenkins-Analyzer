import { computed, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS, isConfigured, JenkinsSettings } from '@domain/jenkins-settings';
import { SettingsRepository, TeamConfigRepository } from '@ports/settings.repository';

/**
 * Paramètres courants, par ordre de priorité :
 * choix de l'utilisateur > réglages de l'équipe (`app-config.json`) > valeurs par défaut.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly repository = inject(SettingsRepository);
  private readonly teamConfig = inject(TeamConfigRepository);
  private teamDefaults: Partial<JenkinsSettings> = {};
  private readonly current = signal<JenkinsSettings>(this.compose());

  readonly settings = this.current.asReadonly();
  readonly isConfigured = computed(() => isConfigured(this.current()));
  /** Libellé court de la source de données, pour l'en-tête. */
  readonly sourceLabel = computed(() => {
    const settings = this.current();
    if (settings.dataSource === 'demo') return 'Données de démo';
    try {
      return new URL(settings.baseUrl).host;
    } catch {
      return settings.baseUrl || 'Jenkins';
    }
  });

  /** À appeler au démarrage : charge les réglages de l'équipe s'ils existent. */
  async loadTeamDefaults(): Promise<void> {
    this.teamDefaults = await this.teamConfig.load();
    this.current.set(this.compose());
  }

  save(settings: JenkinsSettings): void {
    this.repository.save(settings);
    this.current.set(settings);
  }

  private compose(): JenkinsSettings {
    return { ...DEFAULT_SETTINGS, ...this.teamDefaults, ...(this.repository.loadStored() ?? {}) };
  }
}

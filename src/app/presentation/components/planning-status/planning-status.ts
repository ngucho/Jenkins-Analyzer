import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanningStore } from '@application/planning.store';
import { SettingsStore } from '@application/settings.store';
import { formatDateTime } from '../../shared/format';

/**
 * Bandeau commun aux pages de planification : provenance des données,
 * progression du chargement, erreurs et avertissements.
 */
@Component({
  selector: 'app-planning-status',
  imports: [RouterLink],
  templateUrl: './planning-status.html',
  styleUrl: './planning-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanningStatus {
  protected readonly store = inject(PlanningStore);
  private readonly settings = inject(SettingsStore).settings;

  protected readonly phaseLabel = computed(() =>
    this.store.phase() === 'schedules'
      ? 'Lecture des planifications des jobs…'
      : `Chargement de ${this.settings().planningHistoryDays} jours d’historique…`,
  );

  protected readonly info = computed(() => {
    const snapshot = this.store.snapshot();
    if (!snapshot) return null;
    const days = Math.round((snapshot.window.end - snapshot.window.start) / 86_400_000);
    const profile = this.store.profile();
    return {
      text: `${days} j d’historique · ${snapshot.builds.length} builds · ${this.store.scheduledJobs().length} jobs planifiés · ${this.store.capacity()} exécuteurs`,
      fetched: `chargé ${formatDateTime(snapshot.fetchedAt)}`,
      thin: profile !== null && profile.coverage < 1,
    };
  });

  protected readonly warnings = computed(() => {
    const messages: string[] = [];
    const schedules = this.store.schedules();
    const snapshot = this.store.snapshot();
    if (schedules && schedules.unreadableJobs.length > 0) {
      messages.push(
        `Planification illisible pour ${schedules.unreadableJobs.length} job(s) (droit Job/ExtendedRead nécessaire pour lire config.xml) : leur charge est prévue d’après l’historique uniquement.`,
      );
    }
    for (const invalid of this.store.invalidSchedules()) {
      messages.push(`Planification non comprise pour ${invalid.jobName} : ${invalid.reason}`);
    }
    if (snapshot && snapshot.truncatedJobs.length > 0) {
      messages.push(
        `Historique incomplet pour ${snapshot.truncatedJobs.length} job(s) : augmentez « Builds max. par job » dans les paramètres.`,
      );
    }
    if (this.info()?.thin) {
      messages.push('Moins d’une semaine d’historique : certains créneaux de la semaine n’ont jamais été observés.');
    }
    return messages;
  });
}

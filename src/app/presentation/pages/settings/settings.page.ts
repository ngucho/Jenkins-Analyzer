import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SettingsStore } from '@application/settings.store';
import { WorkloadStore } from '@application/workload.store';
import { onlineExecutors } from '@domain/agent-node';
import { JenkinsError } from '@domain/jenkins-error';
import { DataSource, JenkinsSettings } from '@domain/jenkins-settings';
import { JenkinsRepository } from '@ports/jenkins.repository';

type TestState =
  | { readonly status: 'idle' }
  | { readonly status: 'testing' }
  | { readonly status: 'success'; readonly message: string }
  | { readonly status: 'error'; readonly message: string };

const URL_PATTERN = /^https?:\/\/\S+$/i;

@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly settingsStore = inject(SettingsStore);
  private readonly workloadStore = inject(WorkloadStore);
  private readonly repository = inject(JenkinsRepository);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly initial = this.settingsStore.settings();

  protected readonly form = inject(NonNullableFormBuilder).group({
    dataSource: [this.initial.dataSource as DataSource],
    baseUrl: [this.initial.baseUrl, Validators.pattern(URL_PATTERN)],
    username: [this.initial.username],
    apiToken: [this.initial.apiToken],
    useDevProxy: [this.initial.useDevProxy],
    maxBuildsPerJob: [this.initial.maxBuildsPerJob, [Validators.required, Validators.min(10), Validators.max(5000)]],
    idleThresholdMinutes: [this.initial.idleThresholdMinutes, [Validators.required, Validators.min(1)]],
    maintenanceDurationHours: [
      this.initial.maintenanceDurationHours,
      [Validators.required, Validators.min(1), Validators.max(24)],
    ],
  });

  private readonly dataSource = toSignal(this.form.controls.dataSource.valueChanges, {
    initialValue: this.initial.dataSource,
  });
  protected readonly isJenkins = computed(() => this.dataSource() === 'jenkins');
  protected readonly showToken = signal(false);
  protected readonly test = signal<TestState>({ status: 'idle' });
  protected readonly testMessage = computed(() => {
    const test = this.test();
    return 'message' in test ? test.message : null;
  });

  constructor() {
    this.form.controls.dataSource.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((source) => this.toggleJenkinsValidators(source));
    this.toggleJenkinsValidators(this.initial.dataSource);
  }

  protected testConnection(): void {
    if (!this.validate()) return;
    this.test.set({ status: 'testing' });
    this.repository
      .checkConnection(this.value())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          const version = report.version ? `Jenkins ${report.version}` : 'Jenkins';
          const executors = onlineExecutors(report.nodes);
          this.test.set({
            status: 'success',
            message: `✓ ${version} · ${report.jobCount} jobs · ${report.nodes.length} nœud(s), ${executors} exécuteur(s) en ligne`,
          });
        },
        error: (error: unknown) =>
          this.test.set({
            status: 'error',
            message: error instanceof JenkinsError ? error.message : 'Erreur inattendue.',
          }),
      });
  }

  protected save(): void {
    if (!this.validate()) return;
    this.settingsStore.save(this.value());
    this.workloadStore.load();
    void this.router.navigateByUrl('/');
  }

  private value(): JenkinsSettings {
    const raw = this.form.getRawValue();
    return { ...raw, baseUrl: raw.baseUrl.trim().replace(/\/+$/, '') };
  }

  private validate(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }

  private toggleJenkinsValidators(source: DataSource): void {
    const { baseUrl, username, apiToken } = this.form.controls;
    for (const control of [baseUrl, username, apiToken]) {
      if (source === 'jenkins') control.addValidators(Validators.required);
      else control.removeValidators(Validators.required);
      control.updateValueAndValidity({ emitEvent: false });
    }
    this.test.set({ status: 'idle' });
  }
}

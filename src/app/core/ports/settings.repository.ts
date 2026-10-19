import { JenkinsSettings } from '@domain/jenkins-settings';

/** Port de persistance de la configuration. */
export abstract class SettingsRepository {
  abstract load(): JenkinsSettings;
  abstract save(settings: JenkinsSettings): void;
}

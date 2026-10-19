import { JenkinsSettings } from '@domain/jenkins-settings';

/** Port de persistance de la configuration de l'utilisateur. */
export abstract class SettingsRepository {
  /** Paramètres enregistrés par l'utilisateur, ou `null` s'il n'en a jamais enregistré. */
  abstract loadStored(): Partial<JenkinsSettings> | null;
  abstract save(settings: JenkinsSettings): void;
}

/** Port de lecture des réglages par défaut fournis par l'équipe (fichier `app-config.json`). */
export abstract class TeamConfigRepository {
  abstract load(): Promise<Partial<JenkinsSettings>>;
}

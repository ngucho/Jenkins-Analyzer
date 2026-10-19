import { Injectable } from '@angular/core';
import { JenkinsSettings } from '@domain/jenkins-settings';
import { TeamConfigRepository } from '@ports/settings.repository';
import { sanitizeSettings } from './settings-sanitizer';

/** Fichier optionnel déposé à côté de `index.html` pour préremplir les réglages de l'équipe. */
const TEAM_CONFIG_FILE = 'app-config.json';

@Injectable()
export class HttpTeamConfigRepository extends TeamConfigRepository {
  async load(): Promise<Partial<JenkinsSettings>> {
    try {
      const response = await fetch(TEAM_CONFIG_FILE, { cache: 'no-store' });
      if (!response.ok) return {};
      const settings = sanitizeSettings(await response.json());
      // Un identifiant personnel n'a rien à faire dans un fichier partagé.
      const { apiToken: _token, username: _user, ...shared } = settings;
      return shared;
    } catch {
      return {};
    }
  }
}

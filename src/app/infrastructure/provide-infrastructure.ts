import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { JenkinsRepository } from '@ports/jenkins.repository';
import { SettingsRepository, TeamConfigRepository } from '@ports/settings.repository';
import { RoutingJenkinsRepository } from './routing-jenkins.repository';
import { HttpTeamConfigRepository } from './storage/http-team-config.repository';
import { LocalStorageSettingsRepository } from './storage/local-storage-settings.repository';

/** Branche les adaptateurs concrets sur les ports du domaine. */
export function provideInfrastructure(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: JenkinsRepository, useClass: RoutingJenkinsRepository },
    { provide: SettingsRepository, useClass: LocalStorageSettingsRepository },
    { provide: TeamConfigRepository, useClass: HttpTeamConfigRepository },
  ]);
}

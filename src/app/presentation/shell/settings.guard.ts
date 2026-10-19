import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SettingsStore } from '@application/settings.store';

/** Redirige vers les paramètres tant que la connexion Jenkins n'est pas renseignée. */
export const requireSettings: CanActivateFn = () =>
  inject(SettingsStore).isConfigured() || inject(Router).parseUrl('/settings');

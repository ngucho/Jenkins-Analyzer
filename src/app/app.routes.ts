import { Routes } from '@angular/router';
import { requireSettings } from '@presentation/shell/settings.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Charge de travail · Jenkins Workload',
    canActivate: [requireSettings],
    loadComponent: () =>
      import('@presentation/pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'settings',
    title: 'Paramètres · Jenkins Workload',
    loadComponent: () =>
      import('@presentation/pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: '' },
];

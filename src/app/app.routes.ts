import { Routes } from '@angular/router';
import { requireSettings } from '@presentation/shell/settings.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Charge de travail · Jenkins Analyzer',
    canActivate: [requireSettings],
    loadComponent: () =>
      import('@presentation/pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'forecast',
    title: 'Prévisions · Jenkins Analyzer',
    canActivate: [requireSettings],
    loadComponent: () =>
      import('@presentation/pages/forecast/forecast.page').then((m) => m.ForecastPage),
  },
  {
    path: 'optimize',
    title: 'Optimisation · Jenkins Analyzer',
    canActivate: [requireSettings],
    loadComponent: () =>
      import('@presentation/pages/optimize/optimize.page').then((m) => m.OptimizePage),
  },
  {
    path: 'new-job',
    title: 'Nouveau job · Jenkins Analyzer',
    canActivate: [requireSettings],
    loadComponent: () =>
      import('@presentation/pages/new-job/new-job.page').then((m) => m.NewJobPage),
  },
  {
    path: 'settings',
    title: 'Paramètres · Jenkins Analyzer',
    loadComponent: () =>
      import('@presentation/pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: '' },
];

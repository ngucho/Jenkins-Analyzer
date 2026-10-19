import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SettingsStore } from '@application/settings.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <a class="brand" routerLink="/">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="13" width="4" height="9" rx="1.5" />
          <rect x="10" y="7" width="4" height="15" rx="1.5" />
          <rect x="18" y="3" width="4" height="19" rx="1.5" />
        </svg>
        Jenkins Workload
      </a>

      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Tableau de bord</a>
        <a routerLink="/settings" routerLinkActive="active">Paramètres</a>
      </nav>

      <span class="source" [class.demo]="settings.settings().dataSource === 'demo'">
        <span class="led"></span>{{ settings.sourceLabel() }}
      </span>
    </header>

    <main>
      <router-outlet />
    </main>
  `,
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly settings = inject(SettingsStore);
}

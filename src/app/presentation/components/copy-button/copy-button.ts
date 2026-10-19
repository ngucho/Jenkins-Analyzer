import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/** Copie un texte (ex. une expression cron) dans le presse-papiers. */
@Component({
  selector: 'app-copy-button',
  template: `
    <button type="button" (click)="copy()" [title]="'Copier ' + text()">
      <code>{{ text() }}</code>
      <span class="state">{{ copied() ? 'Copié ✓' : 'Copier' }}</span>
    </button>
  `,
  styles: `
    button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: 100%;
      padding: 3px 4px 3px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface-hover);
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      border-color: var(--accent);
    }
    code {
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .state {
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--surface);
      font-size: 11px;
      color: var(--text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyButton {
  readonly text = input.required<string>();
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
    } catch {
      // Contexte non sécurisé (http sur le réseau) : repli sur une sélection temporaire.
      const area = document.createElement('textarea');
      area.value = this.text();
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}

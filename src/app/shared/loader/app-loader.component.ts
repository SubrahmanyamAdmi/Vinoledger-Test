import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-loader" [class.overlay]="overlay" role="status" aria-live="polite" aria-busy="true">
      <div class="app-loader-panel">
        <span class="app-loader-spinner" aria-hidden="true"></span>
        <strong>{{ title }}</strong>
        <span class="app-loader-message" *ngIf="message">{{ message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .app-loader {
      display: grid;
      place-items: center;
      padding: 28px 16px;
    }

    .app-loader.overlay {
      position: fixed;
      inset: 0;
      z-index: 1200;
      padding: 20px;
      background: rgba(8, 20, 38, 0.62);
    }

    .app-loader-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: min(360px, 100%);
      padding: 30px 24px;
      border: 1px solid var(--vl-border);
      border-radius: 12px;
      background: var(--vl-ivory);
      color: var(--vl-navy);
      text-align: center;
      box-shadow: 0 20px 50px rgba(11, 27, 51, 0.2);
    }

    .app-loader:not(.overlay) .app-loader-panel {
      box-shadow: none;
      background: transparent;
      border-color: transparent;
    }

    .app-loader-message {
      color: var(--vl-text-secondary);
      font-size: 0.9rem;
    }

    .app-loader-spinner {
      width: 34px;
      height: 34px;
      border: 3px solid var(--vl-border);
      border-top-color: var(--vl-champagne);
      border-radius: 50%;
      animation: app-loader-spin 0.7s linear infinite;
    }

    @keyframes app-loader-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .app-loader-spinner { animation-duration: 1.8s; }
    }
  `],
})
export class AppLoaderComponent {
  @Input() title = 'Loading...';
  @Input() message = '';
  /** true: full-screen dimmed overlay; false: inline block inside the page content. */
  @Input() overlay = true;
}

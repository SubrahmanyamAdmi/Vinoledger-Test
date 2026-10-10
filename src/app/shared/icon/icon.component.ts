import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Shared line-icon set used across the app so every page renders icons consistently. */
export type AppIconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'logout'
  | 'home'
  | 'file'
  | 'partners'
  | 'bottle'
  | 'person'
  | 'store'
  | 'bell'
  | 'close'
  | 'trash'
  | 'chart'
  | 'receipt'
  | 'wallet'
  | 'cash'
  | 'settings'
  | 'download'
  | 'calendar'
  | 'support';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <ng-container [ngSwitch]="name">
        <ng-container *ngSwitchCase="'chevron-left'">
          <polyline points="15 6 9 12 15 18" />
        </ng-container>
        <ng-container *ngSwitchCase="'chevron-right'">
          <polyline points="9 6 15 12 9 18" />
        </ng-container>
        <ng-container *ngSwitchCase="'logout'">
          <path d="M16 17l5-5-5-5" />
          <line x1="21" y1="12" x2="9" y2="12" />
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </ng-container>
        <ng-container *ngSwitchCase="'home'">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
        </ng-container>
        <ng-container *ngSwitchCase="'file'">
          <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
          <path d="M14 3v5h5" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </ng-container>
        <ng-container *ngSwitchCase="'partners'">
          <circle cx="9" cy="10" r="4" />
          <circle cx="15" cy="10" r="4" />
          <path d="M4 20.5c.5-3.5 3-5.5 5-5.5" />
          <path d="M20 20.5c-.5-3.5-3-5.5-5-5.5" />
        </ng-container>
        <ng-container *ngSwitchCase="'bottle'">
          <path d="M10 2h4v3l1.5 2.5c.33.55.5 1.18.5 1.82V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9.32c0-.64.17-1.27.5-1.82L9.5 5V2z" />
          <line x1="9" y1="12" x2="15" y2="12" />
        </ng-container>
        <ng-container *ngSwitchCase="'person'">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </ng-container>
        <ng-container *ngSwitchCase="'store'">
          <path d="M3 9l1-5h16l1 5" />
          <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
          <path d="M9 20v-6h6v6" />
        </ng-container>
        <ng-container *ngSwitchCase="'bell'">
          <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 3h16z" />
          <path d="M9.5 21a2.5 2.5 0 0 0 5 0" />
        </ng-container>
        <ng-container *ngSwitchCase="'close'">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </ng-container>
        <ng-container *ngSwitchCase="'trash'">
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M5 7l1 14h12l1-14" />
          <path d="M9 7V4h6v3" />
        </ng-container>
        <ng-container *ngSwitchCase="'chart'">
          <path d="M4 18h16" />
          <path d="M7 15V9" />
          <path d="M12 15V5" />
          <path d="M17 15v-7" />
        </ng-container>
        <ng-container *ngSwitchCase="'receipt'">
          <path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="9" y1="12" x2="15" y2="12" />
        </ng-container>
        <ng-container *ngSwitchCase="'wallet'">
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v1.5" />
          <path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5z" />
          <line x1="16" y1="12" x2="19" y2="12" />
        </ng-container>
        <ng-container *ngSwitchCase="'cash'">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 8v8" />
          <path d="M9.5 10.5h4a1.8 1.8 0 0 1 0 3.6h-4a1.8 1.8 0 0 1 0-3.6z" />
        </ng-container>
        <ng-container *ngSwitchCase="'settings'">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.84l.06.06a2 2 0 0 1-2.82 2.82l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .48 1.7 1.7 0 0 0-.4 1.04V21a2 2 0 0 1-4 0v-.08A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.04.4 1.7 1.7 0 0 0-.4 1.04V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-.48-1.04 1.7 1.7 0 0 0-1.04-.4H1a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 2.6 15a1.7 1.7 0 0 0-.4-1.04 1.7 1.7 0 0 0-1.04-.4H1a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 2.6 8.6a1.7 1.7 0 0 0 .4-1.04V7.5a2 2 0 0 1 4 0v.08A1.7 1.7 0 0 0 8.6 8.6a1.7 1.7 0 0 0 1.04.4H10a2 2 0 0 1 0 4h-.08A1.7 1.7 0 0 0 8.6 15a1.7 1.7 0 0 0 .4 1.04 1.7 1.7 0 0 0 1.04.4H10a2 2 0 0 1 0 4h-.08A1.7 1.7 0 0 0 8.6 20.4a1.7 1.7 0 0 0-1.04.4 1.7 1.7 0 0 0-.4 1.04V21a2 2 0 0 1-4 0v-.08A1.7 1.7 0 0 0 1.6 19.4a1.7 1.7 0 0 0-1.04-.4H0a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 1.6 13.4a1.7 1.7 0 0 0 .4-1.04v-.1A2 2 0 0 1 3.98 10.2l.08-.08A1.7 1.7 0 0 0 5.1 8.6a1.7 1.7 0 0 0 .4-1.04V7.5a2 2 0 0 1 2-2h.08A1.7 1.7 0 0 0 8.6 4.6a1.7 1.7 0 0 0 1.04-.4 1.7 1.7 0 0 0 .4-1.04V2.5a2 2 0 0 1 4 0v.08A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.04.4H17a2 2 0 0 1 2 2v.08A1.7 1.7 0 0 0 20.4 8.6a1.7 1.7 0 0 0 .4 1.04v.1a2 2 0 0 1 0 4H20.8A1.7 1.7 0 0 0 19.4 15z" />
        </ng-container>
        <ng-container *ngSwitchCase="'download'">
          <path d="M12 3v12" />
          <path d="M7 18l5 5 5-5" />
          <path d="M4 21h16" />
        </ng-container>
        <ng-container *ngSwitchCase="'calendar'">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <line x1="8" y1="3" x2="8" y2="7" />
          <line x1="16" y1="3" x2="16" y2="7" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </ng-container>
        <ng-container *ngSwitchCase="'support'">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10a3 3 0 1 1 6 0c0 2-3 2-3 5" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </ng-container>
      </ng-container>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; width: 20px; height: 20px; flex: none; }
    svg { width: 100%; height: 100%; }
  `]
})
export class IconComponent {
  @Input() name: AppIconName = 'home';
}

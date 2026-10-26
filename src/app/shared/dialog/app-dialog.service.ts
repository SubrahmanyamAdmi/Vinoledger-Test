import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppDialogType = 'confirmation' | 'warning' | 'success' | 'error' | 'info';

export interface AppDialogDetail {
  label: string;
  value: string;
}

export interface AppDialogOptions {
  type: AppDialogType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  details?: AppDialogDetail[];
}

@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly activeDialogSubject = new BehaviorSubject<AppDialogOptions | null>(null);
  readonly activeDialog$ = this.activeDialogSubject.asObservable();
  private resolveCurrent: ((confirmed: boolean) => void) | null = null;

  get activeDialog(): AppDialogOptions | null {
    return this.activeDialogSubject.value;
  }

  show(options: AppDialogOptions): Promise<boolean> {
    if (this.resolveCurrent) {
      this.close(false);
    }

    return new Promise<boolean>((resolve) => {
      this.resolveCurrent = resolve;
      this.activeDialogSubject.next(options);
    });
  }

  close(confirmed: boolean): void {
    const resolve = this.resolveCurrent;
    if (!resolve) {
      return;
    }

    this.resolveCurrent = null;
    this.activeDialogSubject.next(null);
    resolve(confirmed);
  }
}

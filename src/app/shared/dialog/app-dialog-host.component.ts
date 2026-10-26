import { AfterViewChecked, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppDialogOptions, AppDialogService } from './app-dialog.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './app-dialog-host.component.html',
  styleUrls: ['./app-dialog-host.component.scss'],
})
export class AppDialogHostComponent implements AfterViewChecked {
  @ViewChild('confirmButton') private confirmButton?: ElementRef<HTMLButtonElement>;
  private focusedDialog: AppDialogOptions | null = null;

  constructor(public dialog: AppDialogService) {}

  ngAfterViewChecked(): void {
    const activeDialog = this.currentDialog;
    if (!activeDialog) {
      this.focusedDialog = null;
      return;
    }
    if (activeDialog !== this.focusedDialog && this.confirmButton) {
      this.confirmButton.nativeElement.focus();
      this.focusedDialog = activeDialog;
    }
  }

  get currentDialog(): AppDialogOptions | null {
    return this.dialog.activeDialog;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.currentDialog) {
      this.dialog.close(false);
    }
  }

  close(confirmed: boolean): void {
    this.dialog.close(confirmed);
  }
}

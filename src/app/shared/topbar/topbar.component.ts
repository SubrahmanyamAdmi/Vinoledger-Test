import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button aria-label="menu"><mat-icon>menu</mat-icon></button>
      <span class="title">VinoLedger</span>
      <span class="spacer"></span>
      <button mat-icon-button aria-label="profile"><mat-icon>account_circle</mat-icon></button>
    </mat-toolbar>
  `,
  styles: [`.title{font-weight:700} .spacer{flex:1 1 auto}`]
})
export class TopbarComponent {}

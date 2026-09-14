import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [CommonModule, MatSidenavModule, MatListModule, RouterModule],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav mode="side" opened class="sidenav">
        <mat-nav-list>
          <a mat-list-item routerLink="/admin">Admin</a>
          <a mat-list-item routerLink="/owner">Owner</a>
          <a mat-list-item routerLink="/daily-sales">Daily Sales</a>
          <a mat-list-item routerLink="/inventory">Inventory</a>
          <a mat-list-item routerLink="/expenses">Expenses</a>
          <a mat-list-item routerLink="/accounting">Accounting</a>
          <a mat-list-item routerLink="/reports">Reports</a>
          <a mat-list-item routerLink="/management">Management</a>
          <a mat-list-item routerLink="/profile">Profile</a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <ng-content></ng-content>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`.sidenav-container{height:100vh}.sidenav{width:220px}`]
})
export class SidenavComponent {}

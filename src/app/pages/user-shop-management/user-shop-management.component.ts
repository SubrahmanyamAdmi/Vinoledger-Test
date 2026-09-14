import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { SidenavComponent } from '../../shared/sidenav/sidenav.component';

@Component({
  selector: 'app-user-shop-management',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, TopbarComponent, SidenavComponent],
  templateUrl: './user-shop-management.component.html',
  styleUrls: ['./user-shop-management.component.scss']
})
export class UserShopManagementComponent {}

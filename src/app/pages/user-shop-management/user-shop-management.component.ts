import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-user-shop-management',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './user-shop-management.component.html',
  styleUrls: ['./user-shop-management.component.scss', '../admin-dashboard/admin-page-theme.scss']
})
export class UserShopManagementComponent {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/admin']);
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppIconName, IconComponent } from '../../shared/icon/icon.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss', './admin-page-theme.scss']
})
export class AdminDashboardComponent {
  userName = 'Admin';
  totalRevenueToday = '₹42,850.00';

  constructor(private router: Router, private auth: AuthService) {}

  menuItems: Array<{ label: string; route: string; icon: AppIconName }> = [
    { label: 'Customers & Users', route: '/admin/customers', icon: 'partners' },
    { label: 'Register New Owner', route: '/admin/register-owner', icon: 'person' },
    { label: 'Review Day Sheets', route: '/admin/day-sheet-view', icon: 'file' },
    { label: 'Invoices', route: '/admin/invoices', icon: 'receipt' },
    { label: 'Business Flow', route: '/admin/business-flow', icon: 'chart' },
    { label: 'Update MRP', route: '/admin/update-mrp', icon: 'cash' },
    { label: 'Day Sheet Entry', route: '/admin/day-sheet-entry', icon: 'calendar' },
  ];

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  logout() {
    this.auth.logout();
  }
}

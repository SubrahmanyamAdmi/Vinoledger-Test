import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent {
  userName = 'Admin';
  totalRevenueToday = '₹42,850.00';

  constructor(private router: Router) {}

  menuItems = [
    { 
      label: 'Customers & Users', 
      color: '#000', 
      route: '/admin/customers',
      icon: '👥'
    },
    {
      label: 'Register New Owner',
      color: '#b85c38',
      route: '/admin/register-owner',
      icon: '➕'
    },
    { 
      label: 'Check Day Sheet\n& Download', 
      color: '#66bb6a', 
      route: '/admin/day-sheet-view',
      icon: '📋'
    },
    { 
      label: 'Invoices', 
      color: '#ff9800', 
      route: '/admin/invoices',
      icon: '📄'
    },
    { 
      label: 'Business Flow', 
      color: '#00bcd4', 
      route: '/admin/business-flow',
      icon: '📊'
    },
    { 
      label: 'Update MRP', 
      color: '#455a64', 
      route: '/admin/update-mrp',
      icon: '💰'
    },
    { 
      label: 'Day Sheet Entry', 
      color: '#000', 
      route: '/admin/day-sheet-entry',
      icon: '📝'
    }
  ];

  quickReports = [
    { label: 'Inventory Status', icon: '📦' },
    { label: 'Cash Settlement', icon: '💳' }
  ];

  navigationItems = [
    { label: 'Home', icon: '🏠', route: '/admin' },
    { label: 'Shops', icon: '🏪', route: '/admin/shops' },
    { label: 'Reports', icon: '📊', route: '/admin/reports' },
    { label: 'Settings', icon: '⚙️', route: '/admin/settings' }
  ];

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    this.router.navigate(['/login']);
  }
}

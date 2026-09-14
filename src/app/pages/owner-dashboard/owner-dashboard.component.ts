import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owner-dashboard.component.html',
  styleUrls: ['./owner-dashboard.component.scss']
})
export class OwnerDashboardComponent {
  shopName = '';

  cards = [
    { title: 'Daily Sales', icon: '▥', route: '/owner-daily-sales' },
    { title: 'Invoices', icon: '▤', route: '/owner/invoices' },
    { title: 'Expenses', icon: '−', route: '/expenses' },
    { title: 'Reports', icon: '⌁', route: '/reports' },
    { title: 'Account', icon: '◉', route: '/accounting' },
    { title: 'Contact Admin', icon: '✉', route: '/contact-admin' },
    { title: 'Check MRP', icon: '⌕', route: '/mrp-check' },
    { title: 'Profile', icon: '◯', route: '/profile' },
  ];

  constructor(public auth: AuthService, private router: Router) {
    const user = this.auth.currentUser();
    const sessionShop = this.readSessionShop();
    const registeredShop = this.auth.getRegisteredShops().find((shop) => shop.shopId === user?.shopId);
    this.shopName = registeredShop?.name || sessionShop.name || '';
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  logout() {
    this.auth.logout();
  }

  private readSessionShop(): { name?: string } {
    try {
      return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
    } catch {
      return {};
    }
  }
}

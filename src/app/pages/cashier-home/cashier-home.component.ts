import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IconComponent, AppIconName } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-cashier-home',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './cashier-home.component.html',
  styleUrls: ['./cashier-home.component.scss']
})
export class CashierHomeComponent {
  shopName = '';

  readonly cards: Array<{ title: string; desc: string; icon: AppIconName; route: string }> = [
    { title: 'Day Sheet', desc: 'View and manage daily sales and transactions.', icon: 'file', route: '/sheet-date' },
    { title: 'Manage Partners Transactions', desc: 'Handle partner transactions and settlement details.', icon: 'partners', route: '/manage-partners' },
    { title: 'Stock', desc: 'Check current stock levels and manage inventory.', icon: 'bottle', route: '/stock' },
    { title: 'Profile', desc: 'View and update your profile details.', icon: 'person', route: '/profile' }
  ];

  constructor(public auth: AuthService, private router: Router) {
    const user = this.auth.currentUser();
    const sessionShop = this.readSessionShop();
    const registeredShop = this.auth.getRegisteredShops().find((shop) => shop.shopId === user?.shopId);
    this.shopName = registeredShop?.name || sessionShop.name || 'Assigned Shop';
  }

  navigateTo(route: string) {
    if (!route) {
      return;
    }
    if (route === '/sheet-date') {
      this.ensureSessionShopForCashier();
    }
    this.router.navigate([route]);
  }

  get today(): string {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${date} \u2022 ${time}`;
  }

  private ensureSessionShopForCashier() {
    const user = this.auth.currentUser();
    const registeredShop = this.auth.getRegisteredShops().find((shop) => shop.shopId === user?.shopId || shop.id === user?.shopId);
    const shopRecord = registeredShop || {
      id: user?.shopId || this.shopName || 'assigned-shop',
      shopId: user?.shopId || this.shopName || 'assigned-shop',
      name: this.shopName || 'Assigned Shop',
      owner: user?.name || 'Cashier',
      location: '',
      openingDate: new Date().toISOString().slice(0, 10)
    };

    sessionStorage.setItem('vinoledger.shop', JSON.stringify({
      id: shopRecord.shopId || shopRecord.id,
      shopId: shopRecord.shopId || shopRecord.id,
      name: shopRecord.name,
      owner: shopRecord.ownerName || shopRecord.owner || user?.name || 'Cashier',
      location: shopRecord.location || '',
      openingDate: shopRecord.openingDate || new Date().toISOString().slice(0, 10),
    }));
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

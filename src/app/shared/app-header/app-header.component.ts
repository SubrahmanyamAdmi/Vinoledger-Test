import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-shell-header',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <header class="app-header">
      <div class="product-brand">
        <span class="brand-mark" aria-hidden="true">VL</span>
        <span class="brand-name">VinoLedger</span>
      </div>
      <div class="shop-identity">
        <span class="shop-name">{{ displayShopName }}</span>
      </div>
      <div class="account-identity">
        <span class="account-name">{{ displayAccountName }}</span>
        <span class="account-detail">{{ displayAccountDetail }}</span>
      </div>
      <button type="button" class="app-logout-btn" (click)="auth.logout()">
        <app-icon name="logout"></app-icon>
        <span>Logout</span>
      </button>
    </header>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .app-header {
      position: fixed;
      inset: 0 0 auto;
      z-index: 1200;
      display: grid;
      grid-template-columns: minmax(190px, 0.9fr) minmax(220px, 1.35fr) minmax(180px, 0.9fr) auto;
      align-items: center;
      gap: 20px;
      width: 100%;
      height: 84px;
      padding: 10px 28px;
      background: var(--vl-navy);
      color: var(--vl-white);
      box-shadow: 0 8px 24px rgba(11, 27, 51, 0.12);
      box-sizing: border-box;
    }
    .product-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .brand-mark {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      flex: none;
      border-radius: 10px;
      background: var(--vl-champagne);
      color: var(--vl-navy);
      font: 900 1.05rem/1 'Inter', sans-serif;
    }
    .brand-name {
      color: var(--vl-white);
      font: 700 1.15rem/1.2 'Playfair Display', serif;
      white-space: nowrap;
    }
    .shop-identity,
    .account-identity { min-width: 0; }
    .shop-name {
      overflow: hidden;
      color: var(--vl-white);
      font: 600 1.55rem/1.2 'Playfair Display', serif;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .account-identity {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .account-name {
      overflow: hidden;
      color: var(--vl-white);
      font: 600 0.9rem/1.25 'Inter', sans-serif;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .account-detail {
      overflow: hidden;
      color: var(--vl-champagne);
      font: 600 0.72rem/1.2 'Inter', sans-serif;
      letter-spacing: 0.04em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media (max-width: 900px) {
      .app-header {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-rows: 44px 38px;
        column-gap: 10px;
        row-gap: 2px;
        height: 100px;
        padding: 7px 16px;
      }
      .product-brand { grid-column: 1; grid-row: 1; gap: 9px; }
      .brand-mark { width: 38px; height: 38px; }
      .brand-name { font-size: 1rem; }
      .shop-identity { grid-column: 1; grid-row: 2; }
      .shop-name { font-size: 1.25rem; }
      .account-identity { grid-column: 2; grid-row: 2; text-align: right; }
      .account-name { font-size: 0.76rem; }
      .account-detail { font-size: 0.64rem; }
      .app-header > .app-logout-btn { grid-column: 2; grid-row: 1; }
    }
    @media (max-width: 420px) {
      .app-header { padding-inline: 10px; column-gap: 6px; }
      .brand-name { font-size: 0.9rem; }
      .shop-name { font-size: 1.1rem; }
    }
  `],
})
export class AppHeaderComponent implements OnInit {
  databaseShopName = '';

  constructor(public auth: AuthService, private businessData: BusinessDataService) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    const shopId = String(user?.role === 'Admin' ? '' : user?.shopId || this.readSessionShop().id || '').trim();
    if (!shopId) return;

    this.businessData.getShops().pipe(take(1)).subscribe((shops) => {
      const matchingShop = shops.find((shop: any) =>
        String(shop.shopId || shop.id || '').trim().toUpperCase() === shopId.toUpperCase()
      ) as any;
      this.databaseShopName = String(matchingShop?.shopName || matchingShop?.name || '').trim();
    });
  }

  get displayShopName(): string {
    const user = this.auth.currentUser();
    if (user?.role === 'Admin') return 'Administration';

    const sessionShop = this.readSessionShop();
    const registeredShop = this.auth.getRegisteredShops().find((shop) => shop.shopId === user?.shopId);
    const shopName = this.databaseShopName || sessionShop.name || registeredShop?.name || user?.shopId || '';
    return shopName.replace(/\s+shop$/i, '').trim() || 'Assigned Shop';
  }

  get displayAccountName(): string {
    const user = this.auth.currentUser();
    return user?.name || (user?.role === 'Admin' ? 'Administrator' : 'User');
  }

  get displayAccountDetail(): string {
    const role = this.auth.currentUser()?.role;
    if (role === 'Admin') return 'Admin Console';
    const shopId = String(this.auth.currentUser()?.shopId || this.readSessionShop().id || '').trim();
    return shopId ? `Shop ID: ${shopId}` : 'No shop assigned';
  }

  private readSessionShop(): { id?: string; name?: string } {
    try {
      return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
    } catch {
      return {};
    }
  }
}
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cashier-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cashier-home.component.html',
  styleUrls: ['./cashier-home.component.scss']
})
export class CashierHomeComponent implements OnInit {
  shopId = '';
  shops: { id: string; name: string; owner: string; cashier: string; location: string }[] = [];

  get selectedShop() { return this.shops.find(shop => shop.id === this.shopId); }

  constructor(public auth: AuthService, private router: Router) {
    this.applyShops(this.auth.getRegisteredShops());
  }

  ngOnInit() {
    this.auth.refreshRegisteredShopsFromFirestore().then((shops) => this.applyShops(shops));
  }

  private applyShops(registeredShops: any[]) {
    const user = this.auth.currentUser();
    this.shops = registeredShops
      .filter((shop) => !user?.shopId || shop.shopId === user.shopId)
      .map((shop) => ({
        id: shop.shopId,
        name: shop.name,
        owner: shop.ownerName,
        cashier: user?.name ?? '',
        location: shop.location,
      }));

    this.shopId = user?.shopId ?? this.shops[0]?.id ?? '';
  }

  proceed() {
    if (!this.shopId) return;
    const shop = this.shops.find(item => item.id === this.shopId);
    if (!shop) return;
    sessionStorage.setItem('vinoledger.shop', JSON.stringify(shop));
    this.router.navigate(['/sheet-date']);
  }
}

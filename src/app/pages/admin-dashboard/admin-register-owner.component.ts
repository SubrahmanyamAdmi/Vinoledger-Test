import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, GeneratedCredential, ShopPersonRegistration, ShopRegistration } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppDateInputComponent } from '../../shared/date-input/date-input.component';

interface PersonForm extends ShopPersonRegistration {}

@Component({
  selector: 'app-admin-register-owner',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppDateInputComponent],
  templateUrl: './admin-register-owner.component.html',
  styleUrls: ['./admin-register-owner.component.scss', './admin-page-theme.scss'],
})
export class AdminRegisterOwnerComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  shopId = '';
  shopName = '';
  shopLocation = '';
  today = this.toDateInputValue(new Date());
  shopOpenDate = this.toDateInputValue(new Date());
  owner: PersonForm = this.emptyPerson();
  cashierCount = 2;
  cashiers: PersonForm[] = [this.emptyPerson(), this.emptyPerson()];
  credentials: GeneratedCredential[] = [];
  error = '';

  async register() {
    this.error = '';
    if (!this.isComplete()) {
      this.error = 'Complete every owner, shop and cashier detail before registering.';
      return;
    }

    const registration: ShopRegistration = {
      shopOwner: this.owner,
      shopName: this.shopName,
      shopId: this.shopId,
      shopLocation: this.shopLocation,
      shopOpenDate: this.shopOpenDate,
      cashiers: this.cashiers,
    };

    try {
      this.credentials = (await this.auth.registerShop(registration)).credentials;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unable to register this shop.';
    }
  }

  reset() {
    this.shopId = '';
    this.shopName = '';
    this.shopLocation = '';
    this.shopOpenDate = this.toDateInputValue(new Date());
    this.owner = this.emptyPerson();
    this.cashierCount = 2;
    this.cashiers = [this.emptyPerson(), this.emptyPerson()];
    this.credentials = [];
    this.error = '';
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  updateCashierCount() {
    const count = Math.max(1, Math.min(50, Number(this.cashierCount) || 1));
    this.cashierCount = count;
    while (this.cashiers.length < count) {
      this.cashiers.push(this.emptyPerson());
    }
    this.cashiers = this.cashiers.slice(0, count);
  }

  addCashier() {
    this.cashierCount += 1;
    this.updateCashierCount();
  }

  removeCashier(index: number) {
    if (this.cashiers.length <= 1) return;
    this.cashiers.splice(index, 1);
    this.cashierCount = this.cashiers.length;
  }

  private isComplete(): boolean {
    const values = [this.shopName, this.shopId, this.shopLocation, this.shopOpenDate, ...Object.values(this.owner), ...this.cashiers.flatMap((cashier) => Object.values(cashier))];
    const contactsAreValid = [this.owner, ...this.cashiers].every((person) => /^\d{10}$/.test(String(person.contactNumber).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')));
    return values.every((value) => String(value).trim().length > 0) && contactsAreValid;
  }

  private emptyPerson(): PersonForm {
    return { name: '', email: '', contactNumber: '', address: '' };
  }

  private toDateInputValue(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
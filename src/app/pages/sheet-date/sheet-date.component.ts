import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';

@Component({ selector: 'app-sheet-date', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './sheet-date.component.html', styleUrls: ['./sheet-date.component.scss'] })
export class SheetDateComponent implements OnInit {
  shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{"id":"KKD41","owner":"Y Bathalaswamy"}');
  today = this.toDateInputValue(new Date());
  openingDate = this.getOpeningDate();
  submittedDates: string[] = [];
  date = this.getNextPendingDate();
  dateError = '';
  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService) {
    this.date = this.getNextPendingDate();
    this.dateChanged();
  }

  ngOnInit() {
    const shopId = String(this.shop.id || this.auth.currentUser()?.shopId || '');
    if (!shopId) return;

    this.businessData.getShops().subscribe((shops: any[]) => {
      const databaseShop = shops.find((item) => String(item.shopId || item.id || '').toUpperCase() === shopId.toUpperCase());
      if (!databaseShop) return;

      this.shop = {
        ...this.shop,
        ...databaseShop,
        id: databaseShop.shopId || databaseShop.id,
        owner: databaseShop.ownerName || databaseShop.owner,
        openingDate: databaseShop.openingDate || databaseShop.createdAt,
      };
      sessionStorage.setItem('vinoledger.shop', JSON.stringify(this.shop));
      this.openingDate = this.getOpeningDate();
      this.refreshSubmittedDates();
    });
  }

  isDateSubmitted() {
    return this.submittedDates.includes(this.date);
  }

  dateChanged() {
    const nextDate = this.getNextPendingDate();
    if (this.date !== nextDate) {
      this.date = nextDate;
      this.dateError = `Submit the day sheet for ${this.formatDate(nextDate)} before continuing.`;
      return;
    }
    this.dateError = '';
  }

  open(path: string) {
    this.dateChanged();
    if (this.isDateSubmitted() || !!this.dateError || this.date !== this.getNextPendingDate() || !this.date || this.date > this.today) {
      return;
    }
    sessionStorage.setItem('vinoledger.date', this.date);
    this.router.navigateByUrl(path);
  }

  private refreshSubmittedDates() {
    const shopId = String(this.shop.id || this.auth.currentUser()?.shopId || 'KKD41');

    this.businessData.getDaySheets().subscribe({
      next: (sheets: any[]) => {
        const databaseDates = (Array.isArray(sheets) ? sheets : [])
          .filter((item: any) => String(item.shopId || item.shop?.id || '').toUpperCase() === shopId.toUpperCase())
          .map((item: any) => String(item.date || '').slice(0, 10))
          .filter((date) => !!date);

        const localDates = this.loadSubmittedDates();
        this.submittedDates = [...new Set([...databaseDates, ...localDates])];
        this.date = this.getNextPendingDate();
        this.dateChanged();
      },
      error: () => {
        this.submittedDates = this.loadSubmittedDates();
        this.date = this.getNextPendingDate();
        this.dateChanged();
      }
    });
  }

  private loadSubmittedDates(): string[] {
    try {
      const allSubmitted = JSON.parse(localStorage.getItem('vinoledger.submittedDates') || '{}');
      const shopDates = allSubmitted[String(this.shop.id || 'KKD41')];
      return Array.isArray(shopDates) ? [...new Set(shopDates.map((date: string) => String(date).slice(0, 10)))] : [];
    } catch {
      return [];
    }
  }

  private getNextPendingDate() {
    const start = new Date(`${this.openingDate}T00:00:00`);
    const end = new Date(`${this.today}T00:00:00`);
    for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const date = this.toDateInputValue(current);
      if (!this.submittedDates.includes(date)) return date;
    }
    return this.today;
  }

  private getOpeningDate() {
    const createdAt = String(this.shop.openingDate || this.shop.createdAt || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(createdAt) && createdAt <= this.today ? createdAt : this.today;
  }

  private formatDate(value: string) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  }

  private toDateInputValue(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

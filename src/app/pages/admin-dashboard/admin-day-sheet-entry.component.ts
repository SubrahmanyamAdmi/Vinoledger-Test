import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BusinessDataService } from '../../services/business-data.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppLoaderComponent } from '../../shared/loader/app-loader.component';
import { AppDateInputComponent } from '../../shared/date-input/date-input.component';
import { AppSelectComponent, AppSelectOption } from '../../shared/select/select.component';

@Component({
  selector: 'app-admin-day-sheet-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppLoaderComponent, AppSelectComponent, AppDateInputComponent],
  templateUrl: './admin-day-sheet-entry.component.html',
  styleUrls: ['./admin-day-sheet-entry.component.scss', './admin-page-theme.scss']
})
export class AdminDaySheetEntryComponent {
  shops: Array<{ id: string; name: string; owner: string; openingDate?: string }> = [];
  submittedDates: string[] = [];
  submittedDateDetails: Record<string, string> = {};
  dateError = '';
  isLoadingDates = true;

  selectedShopId = '';
  today = this.toIsoDate(new Date());
  date = this.today;

  get shopOptions(): AppSelectOption[] {
    return this.shops.map((shop) => ({ value: shop.id, label: `${shop.owner} - ${shop.id}` }));
  }

  constructor(private router: Router, private businessData: BusinessDataService) {
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.shop') || 'null');
    if (saved && saved.id) {
      this.selectedShopId = saved.id;
    }
    const savedDate = sessionStorage.getItem('vinoledger.date');
    if (savedDate) {
      this.date = savedDate;
    }

    this.loadShops();
  }

  private loadShops() {
    this.businessData.getShops().subscribe({
      next: (shops: any[]) => {
        this.shops = shops
          .map((shop) => ({
            id: String(shop.shopId || shop.id || ''),
            name: shop.name || shop.shopId || shop.id || '',
            owner: shop.ownerName || shop.owner || 'N/A',
            openingDate: String(shop.openingDate || shop.createdAt || '').slice(0, 10)
          }))
          .filter((shop) => shop.id);

        if (!this.selectedShopId && this.shops.length) {
          this.selectedShopId = this.shops[0].id;
        }

        this.refreshSubmittedDates();
      },
      error: () => {
        this.shops = [];
        this.selectedShopId = '';
        this.submittedDates = [];
        this.submittedDateDetails = {};
        this.dateError = '';
        this.isLoadingDates = false;
      }
    });
  }

  onShopChange() {
    this.date = '';
    this.submittedDates = [];
    this.submittedDateDetails = {};
    this.dateError = '';
    this.refreshSubmittedDates();
  }

  dateChanged() {
    if (this.date > this.today) {
      this.dateError = 'Future dates are not allowed. Choose today or an earlier date.';
      return;
    }

    const submittedBy = this.date ? this.submittedDateDetails[this.date] : '';
    this.dateError = this.date && this.submittedDates.includes(this.date)
      ? submittedBy
        ? `This date has already been submitted by ${submittedBy} for ${this.selectedShop?.id || 'the selected shop'}. Choose another date.`
        : `This date has already been submitted for ${this.selectedShop?.id || 'the selected shop'}. Choose another date.`
      : '';
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private refreshSubmittedDates() {
    const shopId = this.selectedShopId;
    if (!shopId) {
      this.submittedDates = [];
      this.submittedDateDetails = {};
      this.dateError = '';
      this.isLoadingDates = false;
      return;
    }

    this.isLoadingDates = true;
    this.businessData.getDaySheets().subscribe({
      next: (sheets: any[]) => {
        const knownDetails: Record<string, string> = {};
        const knownDates = new Set<string>();
        (Array.isArray(sheets) ? sheets : [])
          .filter((sheet: any) => String(sheet.shopId || sheet.shop?.id || '').toUpperCase() === shopId.toUpperCase())
          .forEach((sheet: any) => {
            const date = String(sheet.date || '').slice(0, 10);
            if (!date) return;
            knownDates.add(date);
            const submittedBy = String(sheet.cashier || sheet.submittedBy || sheet.cashierName || '').trim();
            if (submittedBy) {
              knownDetails[date] = submittedBy;
            }
          });

        const fallbackDetails = this.loadSubmittedDetailsFromStorage();
        this.submittedDateDetails = { ...fallbackDetails, ...knownDetails };
        this.submittedDates = [...new Set([...knownDates, ...Object.keys(fallbackDetails)])];
        this.date = this.getNextPendingDate();
        this.dateChanged();
        this.isLoadingDates = false;
      },
      error: () => {
        this.submittedDateDetails = this.loadSubmittedDetailsFromStorage();
        this.submittedDates = [...new Set(Object.keys(this.submittedDateDetails))];
        this.date = this.getNextPendingDate();
        this.dateChanged();
        this.isLoadingDates = false;
      }
    });
  }

  private loadSubmittedDetailsFromStorage(): Record<string, string> {
    const details: Record<string, string> = {};
    try {
      const history = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      if (!Array.isArray(history)) {
        return details;
      }

      history.forEach((item: any) => {
        const itemShopId = String(item.shopId || item.shop?.id || '').toUpperCase();
        if (itemShopId !== String(this.selectedShopId || '').toUpperCase()) {
          return;
        }

        const date = String(item.date || '').slice(0, 10);
        if (!date) {
          return;
        }

        const cashier = String(item.cashier || item.submittedBy || item.cashierName || '').trim();
        if (cashier) {
          details[date] = cashier;
        }
      });
    } catch {
      return details;
    }

    return details;
  }

  private getNextPendingDate(): string {
    const openingDate = this.selectedShop.openingDate;
    if (!openingDate || !/^\d{4}-\d{2}-\d{2}$/.test(openingDate) || openingDate > this.today) {
      return this.today;
    }

    const start = new Date(`${openingDate}T00:00:00`);
    const end = new Date(`${this.today}T00:00:00`);
    for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const date = this.toIsoDate(current);
      if (!this.submittedDates.includes(date)) {
        return date;
      }
    }
    return this.today;
  }

  get selectedShop() {
    return this.shops.find(shop => shop.id === this.selectedShopId) || this.shops[0] || {
      id: this.selectedShopId,
      name: '',
      owner: 'N/A',
      openingDate: ''
    };
  }

  open(path: string) {
    if (!this.selectedShopId) {
      alert('Please select a shop first.');
      return;
    }

    this.dateChanged();
    if (this.dateError) {
      return;
    }

    sessionStorage.setItem('vinoledger.shop', JSON.stringify(this.selectedShop));
    sessionStorage.setItem('vinoledger.date', this.date);
    this.router.navigateByUrl(path);
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}

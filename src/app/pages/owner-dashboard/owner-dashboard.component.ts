import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import { combineLatest, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AppIconName, IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './owner-dashboard.component.html',
  styleUrls: ['./owner-dashboard.component.scss']
})
export class OwnerDashboardComponent {
  shopName = '';
  presentStockValue = 0;
  presentCashValue = 0;
  isLoadingFigures = true;

  cards: Array<{ title: string; desc: string; icon: AppIconName; route: string }> = [
    { title: 'Daily Sales', desc: 'Track cash movement and sales', icon: 'chart', route: '/owner-daily-sales' },
    { title: 'Invoices', desc: 'Review and export invoices', icon: 'receipt', route: '/owner/invoices' },
    { title: 'Generate Invoice', desc: 'Create fresh billing entries', icon: 'file', route: '/generate-invoice' },
    { title: 'Expenses', desc: 'Monitor business expenses', icon: 'wallet', route: '/expenses' },
    { title: 'Reports', desc: 'Compare trends and outcomes', icon: 'chart', route: '/reports' },
    { title: 'Accounting', desc: 'Check ledger and balances', icon: 'cash', route: '/accounting' },
    { title: 'Contact Admin', desc: 'Support and assistance', icon: 'person', route: '/contact-admin' },
    { title: 'Update MRP', desc: 'Set pricing and product value', icon: 'store', route: '/mrp-check' },
    { title: 'Manage Partners', desc: 'Track partners and vendors', icon: 'partners', route: '/manage-partners' },
    { title: 'Stock', desc: 'Inventory and bottling status', icon: 'bottle', route: '/stock' },
    { title: 'Profile', desc: 'Update account preferences', icon: 'person', route: '/profile' },
  ];

  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService) {
    const user = this.auth.currentUser();
    const sessionShop = this.readSessionShop();
    const registeredShop = this.auth.getRegisteredShops().find((shop) => shop.shopId === user?.shopId);
    this.shopName = registeredShop?.name || sessionShop.name || '';
    const shopId = user?.shopId || sessionShop.id || '';
    combineLatest([
      this.businessData.getDaySheets().pipe(catchError(() => of([] as any[]))),
      this.businessData.getInvoices().pipe(catchError(() => of([] as any[])))
    ]).subscribe(([daySheets, invoices]) => {
      const normalizedShopId = String(shopId).toUpperCase();
      const submissions = daySheets.filter((item: any) =>
        String(item.shopId || item.shop?.id || '').toUpperCase() === normalizedShopId
      );
      const localSubmissions = this.loadSubmissions(shopId);
      const matchingSubmissions = submissions.length ? submissions : localSubmissions;
      const matchingInvoices = invoices.length ? invoices : this.loadInvoices(shopId);
      this.loadLatestFigures(matchingSubmissions, matchingInvoices);
      this.isLoadingFigures = false;
    });
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  logout() {
    this.auth.logout();
  }

  private readSessionShop(): { name?: string; id?: string } {
    try {
      return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
    } catch {
      return {};
    }
  }

  private loadLatestFigures(submissions: any[], invoices: any[]) {
    const latest = [...submissions].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    this.presentStockValue = latest
      ? (latest.records || []).reduce((sum: number, record: any) =>
        sum + (record.sizes || []).reduce((sizeSum: number, size: any) =>
          sizeSum + Number(size.closing || 0) * Number(size.price || 0), 0), 0)
      : 0;

    const latestStoredValue = Number(latest.presentCashValue);
    if (Number.isFinite(latestStoredValue)) {
      this.presentCashValue = latestStoredValue;
      return;
    }

    const totalDaySheetValue = submissions.reduce((sum, sheet) => sum + Number(sheet.grandTotal || 0), 0);
    const totalInvoiceValue = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    this.presentCashValue = totalDaySheetValue - totalInvoiceValue;
  }

  private loadSubmissions(shopId: string): any[] {
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      return Array.isArray(saved) ? saved.filter((item) => String(item.shopId || '').toUpperCase() === shopId.toUpperCase()) : [];
    } catch {
      return [];
    }
  }

  private loadInvoices(shopId: string): any[] {
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.invoices') || '[]');
      return Array.isArray(saved)
        ? saved.filter((item) => String(item.shopId || item.shop?.id || '').toUpperCase() === shopId.toUpperCase())
        : [];
    } catch {
      return [];
    }
  }
}

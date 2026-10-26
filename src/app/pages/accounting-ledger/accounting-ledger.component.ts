import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import { ExpenseEntry, flattenDaySheetExpenses } from '../../services/expense-entries';
import {
  BenefitEntry,
  DailyRow,
  StockCashSnapshot,
  benefitEntries,
  dailyRows,
  filterByShop,
  stockCashSnapshot,
} from '../../services/accounting-figures';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PartnerDataService,
  PartnerManagementData,
  PartnerRecord,
  PartnerTransactionRecord,
  ProfitDistributionRecord,
} from '../../services/partner-data.service';
import { AppDateInputComponent } from '../../shared/date-input/date-input.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppLoaderComponent } from '../../shared/loader/app-loader.component';

export interface AccountingSection {
  id: string;
  label: string;
  description: string;
}

export interface PartnerSummaryRow {
  partner: PartnerRecord;
  stockTaken: number;
  cashTaken: number;
  pending: number;
}

@Component({
  selector: 'app-accounting-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule, AppDateInputComponent, IconComponent, AppLoaderComponent],
  templateUrl: './accounting-ledger.component.html',
  styleUrls: ['./accounting-ledger.component.scss']
})
export class AccountingLedgerComponent implements OnInit {
  readonly sections: AccountingSection[] = [
    { id: 'partners', label: '1. Investments & Partner Transactions', description: 'Investments, stock/cash taken, distributions' },
    { id: 'expenses', label: '2. Expenses', description: 'Shop expenses by category and date' },
    { id: 'stock-cash', label: '3. Stock & Cash Value', description: 'Present stock value and cash value' },
    { id: 'adjustments', label: '4. Discounts / Additional Profit', description: 'Empty bottles, brand discounts, other benefits' },
    { id: 'daily', label: '5. Daily Sales, Purchase & Expenses', description: 'Date-wise sale, purchase and expenses' },
  ];
  mobileSectionOpen = false;
  readonly today = this.toLocalIsoDate(new Date());
  readonly shopName = this.readShopName();
  activeSection = 'partners';
  fromDate = this.today.slice(0, 8) + '01';
  toDate = this.today;
  isLoading = true;
  data: PartnerManagementData = { partners: [], partnerTransactions: [], profitDistributions: [] };
  allExpenses: ExpenseEntry[] = [];
  allSheets: any[] = [];
  allInvoices: any[] = [];
  shopId = '';

  constructor(public auth: AuthService, private partnerData: PartnerDataService, private business: BusinessDataService) {}

  async ngOnInit() {
    const shopId = String(this.auth.currentUser()?.shopId || this.readSessionShop().id || '');
    this.shopId = shopId;
    const [partnerData, daySheets, invoices] = await Promise.all([
      this.partnerData.load(shopId),
      firstValueFrom(this.business.getDaySheets().pipe(catchError(() => of([])))),
      firstValueFrom(this.business.getInvoices().pipe(catchError(() => of([])))),
    ]);
    this.data = partnerData;
    this.allSheets = filterByShop(daySheets, shopId);
    this.allInvoices = filterByShop(invoices, shopId);
    this.allExpenses = flattenDaySheetExpenses(daySheets, shopId);
    this.isLoading = false;
  }

  get sheetsInRange() {
    return this.allSheets.filter((sheet) => this.inRange(sheet.date));
  }

  // Stock and cash are shown as of the end of the selected period.
  get stockCash(): StockCashSnapshot | null {
    return stockCashSnapshot(this.allSheets, this.allInvoices, this.toDate);
  }

  get companyWorth() {
    return (this.stockCash?.stockValue || 0) + (this.stockCash?.cashValue || 0);
  }

  get benefitsInRange(): BenefitEntry[] {
    return benefitEntries(this.sheetsInRange).sort((a, b) => a.date.localeCompare(b.date));
  }

  get benefitsTotal() {
    return this.benefitsInRange.reduce((sum, entry) => sum + entry.amount, 0);
  }

  get benefitCategories() {
    const byName = new Map<string, number>();
    this.benefitsInRange.forEach((entry) => byName.set(entry.name, (byName.get(entry.name) || 0) + entry.amount));
    return [...byName.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }

  get dailyRowsInRange(): DailyRow[] {
    return dailyRows(this.sheetsInRange, this.allInvoices.filter((invoice) => this.inRange(invoice.date)));
  }

  get dailyTotals() {
    return this.dailyRowsInRange.reduce(
      (total, row) => ({ sale: total.sale + row.sale, purchase: total.purchase + row.purchase, expenses: total.expenses + row.expenses }),
      { sale: 0, purchase: 0, expenses: 0 }
    );
  }

  get expensesInRange(): ExpenseEntry[] {
    return this.allExpenses
      .filter((entry) => this.inRange(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  get expensesTotal() {
    return this.expensesInRange.reduce((sum, entry) => sum + entry.amount, 0);
  }

  get expenseCategories(): { category: string; amount: number; percentage: number }[] {
    const total = this.expensesTotal;
    const byCategory = new Map<string, number>();
    this.expensesInRange.forEach((entry) => byCategory.set(entry.category, (byCategory.get(entry.category) || 0) + entry.amount));
    return [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount, percentage: total ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }

  get currentSection() {
    return this.sections.find((section) => section.id === this.activeSection) || this.sections[0];
  }

  get invalidRange() {
    return !!this.fromDate && !!this.toDate && this.fromDate > this.toDate;
  }

  get totalInvestment() {
    return this.data.partners.reduce((sum, partner) => sum + Number(partner.investmentAmount || 0), 0);
  }

  get totalProfitShare() {
    return this.data.partners.reduce((sum, partner) => sum + Number(partner.profitShare || 0), 0);
  }

  get transactionsInRange(): PartnerTransactionRecord[] {
    return this.data.partnerTransactions
      .filter((entry) => this.inRange(entry.createdAt))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  get distributionsInRange(): ProfitDistributionRecord[] {
    return this.data.profitDistributions
      .filter((entry) => this.inRange(entry.createdAt))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  get distributionsTotal() {
    return this.distributionsInRange.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  // Taken amounts follow the selected range; pending is the outstanding balance till date.
  get partnerSummary(): PartnerSummaryRow[] {
    const inRange = this.transactionsInRange;
    return this.data.partners.map((partner) => {
      const taken = (type: string) => inRange
        .filter((entry) => entry.partnerName === partner.name && entry.transactionType === type)
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const pending = this.data.partnerTransactions
        .filter((entry) => entry.partnerName === partner.name)
        .reduce((sum, entry) => {
          const amount = Number(entry.amount || 0);
          return entry.paymentStatus === 'Paid' ? Math.max(0, sum - amount) : sum + amount;
        }, 0);
      return { partner, stockTaken: taken('Stock Taken'), cashTaken: taken('Cash'), pending };
    });
  }

  get summaryTotals() {
    return this.partnerSummary.reduce(
      (total, row) => ({
        stockTaken: total.stockTaken + row.stockTaken,
        cashTaken: total.cashTaken + row.cashTaken,
        pending: total.pending + row.pending,
      }),
      { stockTaken: 0, cashTaken: 0, pending: 0 }
    );
  }

  selectSection(section: AccountingSection) {
    this.activeSection = section.id;
    this.mobileSectionOpen = true;
    window.scrollTo({ top: 0 });
  }

  closeMobileSection() {
    this.mobileSectionOpen = false;
    window.scrollTo({ top: 0 });
  }

  print() {
    window.print();
  }

  private inRange(value: string) {
    const day = String(value || '').slice(0, 10);
    return (!this.fromDate || day >= this.fromDate) && (!this.toDate || day <= this.toDate);
  }

  private toLocalIsoDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private readSessionShop(): { id?: string; name?: string; shopName?: string } {
    try {
      return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
    } catch {
      return {};
    }
  }

  private readShopName() {
    const shop = this.readSessionShop();
    return shop.name || shop.shopName || '';
  }
}

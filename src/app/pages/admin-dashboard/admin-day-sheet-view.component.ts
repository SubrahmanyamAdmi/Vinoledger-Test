import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BusinessDataService } from '../../services/business-data.service';

@Component({
  selector: 'app-admin-day-sheet-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-day-sheet-view.component.html',
  styleUrls: ['./admin-day-sheet-view.component.scss']
})
export class AdminDaySheetViewComponent implements OnInit {
  shops: Array<{ id: string; name: string; owner: string }> = [];
  private allDaySheets: any[] = [];

  selectedShopId = '';
  selectedDate = '';
  calendarMonth = new Date();
  calendarWeeks: Array<Array<{ day: number; inMonth: boolean; isSelected: boolean; value: string }>> = [];
  daySheetData: any = null;
  sheetFound = false;
  noSheetDialogOpen = false;
  noSheetMessage = '';
  deleteDialogOpen = false;

  get canViewDaySheet(): boolean {
    return Boolean(this.selectedShopId && this.selectedDate);
  }

  get canDeleteDaySheet(): boolean {
    if (!this.sheetFound || !this.daySheetData || !this.selectedShopId) {
      return false;
    }

    const reportShopId = this.normalizeShopId(String(this.daySheetData.shop?.id || ''));
    const reportDate = this.normalizeDate(String(this.daySheetData.date || ''));
    if (reportShopId !== this.normalizeShopId(this.selectedShopId) || reportDate !== this.normalizeDate(this.selectedDate)) {
      return false;
    }

    const latest = this.getLatestSubmissionForShop(this.selectedShopId);
    return Boolean(latest &&
      this.normalizeDate(String(latest.date || '')) === reportDate);
  }

  loadingShops = true;
  shopLoadError = '';

  constructor(private router: Router, private businessData: BusinessDataService) {}

  ngOnInit() {
    this.businessData.getShops().subscribe({
      next: (shops: any[]) => {
        this.shops = shops.map((shop) => ({
          id: String(shop.shopId || shop.id || ''),
          name: shop.name || shop.shopId || shop.id || '',
          owner: shop.ownerName || shop.owner || 'N/A'
        })).filter((shop) => shop.id);
        this.selectedShopId = this.shops[0]?.id || '';
        this.loadingShops = false;
      },
      error: () => {
        this.shopLoadError = 'Unable to load shops from Firebase.';
        this.loadingShops = false;
      }
    });

    this.businessData.getDaySheets().subscribe({
      next: (sheets: any[]) => {
        this.allDaySheets = Array.isArray(sheets) ? sheets : [];
      },
      error: () => {
        this.allDaySheets = [];
      }
    });
    this.updateCalendar();
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(this.calendarMonth);
  }

  get formattedSelectedDate(): string {
    if (!this.selectedDate) {
      return 'Select a date';
    }
    const date = new Date(this.selectedDate);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date).replace(/\//g, '-');
  }

  updateCalendar() {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    const weeks: Array<Array<{ day: number; inMonth: boolean; isSelected: boolean; value: string }>> = [];

    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const days = [] as Array<{ day: number; inMonth: boolean; isSelected: boolean; value: string }>;

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const current = new Date(gridStart);
        current.setDate(gridStart.getDate() + (weekIndex * 7) + dayIndex);
        const value = this.toIsoDate(current);
        days.push({
          day: current.getDate(),
          inMonth: current.getMonth() === month,
          isSelected: value === this.selectedDate,
          value
        });
      }

      weeks.push(days);
    }

    this.calendarWeeks = weeks;
  }

  previousMonth() {
    const nextMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
    this.calendarMonth = nextMonth;
    this.updateCalendar();
  }

  nextMonth() {
    const nextMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
    this.calendarMonth = nextMonth;
    this.updateCalendar();
  }

  selectDate(value: string) {
    if (!value) {
      return;
    }
    this.selectedDate = value;
    this.calendarMonth = new Date(value);
    this.updateCalendar();
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getShopOwner(): string {
    const shop = this.shops.find(s => s.id === this.selectedShopId);
    return shop ? shop.owner : 'N/A';
  }

  getShopName(): string {
    const shop = this.shops.find(s => s.id === this.selectedShopId);
    return shop ? shop.name : '';
  }

  viewDaySheet() {
    if (!this.selectedShopId || !this.selectedDate) {
      this.noSheetMessage = 'Please select both a shop and a date.';
      this.noSheetDialogOpen = true;
      return;
    }

    const saved = this.readSubmissionForSelectedDate();
    if (!saved) {
      this.daySheetData = null;
      this.sheetFound = false;
      this.noSheetMessage = `No day sheet was submitted for ${this.formatDate(this.selectedDate)} for ${this.getShopOwner()} (${this.selectedShopId}).`;
      this.noSheetDialogOpen = true;
      return;
    }

    this.daySheetData = {
      shop: saved.shop || { id: this.selectedShopId, name: this.getShopName(), owner: this.getShopOwner() },
      date: saved.date || this.selectedDate,
      records: Array.isArray(saved.records) ? saved.records : [],
      expenses: Array.isArray(saved.expenses) ? saved.expenses : [],
      additionalProfitRows: Array.isArray(saved.additionalProfitRows) ? saved.additionalProfitRows : [],
      cashDetails: saved.cashDetails || {},
      additionalProfit: Number(saved.additionalProfit || 0),
      totalDaySale: Number(saved.totalDaySale || 0),
      totalExpenses: Number(saved.totalExpenses || 0),
      grandTotal: Number(saved.grandTotal || 0),
      submittedAmount: Number(saved.submittedAmount || 0),
      submittedAt: saved.submittedAt || null
    };
    this.sheetFound = true;
    this.noSheetDialogOpen = false;
  }

  closeNoSheetDialog() {
    this.noSheetDialogOpen = false;
  }

  downloadPDF() {
    if (!this.daySheetData) {
      alert('No day sheet data to download');
      return;
    }

    const csv = this.buildExcelRows()
      .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `day-sheet-${this.daySheetData.shop?.id || this.selectedShopId}-${this.daySheetData.date || this.selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  openDeleteConfirmation() {
    if (this.canDeleteDaySheet) {
      this.deleteDialogOpen = true;
    }
  }

  closeDeleteConfirmation() {
    this.deleteDialogOpen = false;
  }

  confirmDeleteDaySheet() {
    if (!this.daySheetData || !this.canDeleteDaySheet) {
      this.closeDeleteConfirmation();
      return;
    }

    const daySheetId = String(this.daySheetData.id || '');
    if (daySheetId) {
      this.businessData.deleteDaySheet(daySheetId).catch(() => undefined);
    }

    this.removeSubmissionFromHistory();
    this.removeSubmittedDate();
    sessionStorage.removeItem('vinoledger.daySheetSubmission');
    localStorage.removeItem('vinoledger.daySheetSubmission');
    this.closeDeleteConfirmation();
    this.daySheetData = null;
    this.sheetFound = false;
  }

  private readSubmissionForSelectedDate() {
    const requestedShopId = this.normalizeShopId(this.selectedShopId);
    const requestedDate = this.normalizeDate(this.selectedDate);

    const savedFromDatabase = this.allDaySheets.find((item: any) =>
      this.normalizeShopId(String(item.shopId || item.shop?.id || '')) === requestedShopId &&
      this.normalizeDate(String(item.date || '')) === requestedDate
    );
    if (savedFromDatabase) {
      return savedFromDatabase;
    }

    try {
      const history = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      if (Array.isArray(history)) {
        const saved = history.find((item: any) =>
          this.normalizeShopId(String(item.shopId || item.shop?.id || '')) === requestedShopId &&
          this.normalizeDate(String(item.date || '')) === requestedDate
        );
        if (saved) {
          return saved;
        }
      }
    } catch {
      // Fall back to the current session record for older submissions.
    }

    const raw = localStorage.getItem('vinoledger.daySheetSubmission') || sessionStorage.getItem('vinoledger.daySheetSubmission');
    if (!raw) {
      return null;
    }

    try {
      const saved = JSON.parse(raw);
      const savedShopId = this.normalizeShopId(String(saved.shopId || saved.shop?.id || ''));
      const savedDate = this.normalizeDate(String(saved.date || ''));
      const matchesShop = !requestedShopId || savedShopId === requestedShopId;
      const matchesDate = !requestedDate || savedDate === requestedDate;
      if (!matchesShop || !matchesDate) {
        return null;
      }
      return saved;
    } catch {
      return null;
    }
  }

  private getLatestSubmissionForShop(shopId: string): any | null {
    const fromDatabase = this.allDaySheets
      .filter((item: any) => this.normalizeShopId(String(item.shopId || item.shop?.id || '')) === this.normalizeShopId(shopId));

    if (fromDatabase.length) {
      return fromDatabase.reduce((latest: any, item: any) => {
        if (!latest) {
          return item;
        }
        const latestTime = Date.parse(String(latest.submittedAt || '')) || 0;
        const itemTime = Date.parse(String(item.submittedAt || '')) || 0;
        return itemTime >= latestTime ? item : latest;
      }, null);
    }

    try {
      const history = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      if (!Array.isArray(history)) {
        return null;
      }

      return history
        .filter((item: any) => this.normalizeShopId(String(item.shopId || item.shop?.id || '')) === this.normalizeShopId(shopId))
        .reduce((latest: any, item: any) => {
          if (!latest) {
            return item;
          }
          const latestTime = Date.parse(String(latest.submittedAt || '')) || 0;
          const itemTime = Date.parse(String(item.submittedAt || '')) || 0;
          return itemTime >= latestTime ? item : latest;
        }, null);
    } catch {
      return null;
    }
  }

  private removeSubmissionFromHistory() {
    try {
      const history = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      if (Array.isArray(history)) {
        const filtered = history.filter((item: any) =>
          String(item.shopId || item.shop?.id || '') !== this.selectedShopId || item.date !== this.selectedDate
        );
        localStorage.setItem('vinoledger.daySheetSubmissions', JSON.stringify(filtered));
      }
    } catch {
      // Nothing to remove when local history is unavailable.
    }
  }

  private removeSubmittedDate() {
    try {
      const submitted = JSON.parse(localStorage.getItem('vinoledger.submittedDates') || '{}');
      const shopId = this.normalizeShopId(this.selectedShopId);
      if (Array.isArray(submitted[shopId])) {
        submitted[shopId] = submitted[shopId].filter((date: string) =>
          this.normalizeDate(date) !== this.normalizeDate(this.selectedDate));
        localStorage.setItem('vinoledger.submittedDates', JSON.stringify(submitted));
      }
    } catch {
      // Ignore unavailable local history metadata.
    }
  }

  formatSubmittedAt(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }
    return new Date(value).toLocaleString();
  }

  private normalizeShopId(value: string) {
    return String(value || '').trim().toUpperCase();
  }

  private normalizeDate(value: string) {
    const trimmed = String(value || '').trim();
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : trimmed;
  }

  private formatDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  getRecordSale(record: any): number {
    if (!record || !Array.isArray(record.sizes)) {
      return 0;
    }

    return record.sizes.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  }

  private buildReportRows(): Array<[string, string, string, string, string, string]> {
    if (!this.daySheetData?.records?.length) {
      return [[this.getShopName(), this.selectedShopId, this.selectedDate, '0', '0', '0']];
    }

    return this.daySheetData.records.map((record: any) => {
      const totalRecordSale = this.getRecordSale(record);

      return [
        record.brand || 'N/A',
        record.code || 'N/A',
        String(totalRecordSale),
        String(this.daySheetData.totalExpenses || 0),
        String(this.daySheetData.additionalProfit || 0),
        String(this.daySheetData.grandTotal || 0)
      ];
    });
  }

  private buildExcelRows(): string[][] {
    const sheet = this.daySheetData;
    const rows: string[][] = [
      ['VinoLedger Day Sheet Report'],
      ['Shop', sheet.shop?.name || this.getShopName()],
      ['Shop ID', sheet.shop?.id || this.selectedShopId],
      ['Owner', sheet.shop?.owner || this.getShopOwner()],
      ['Submitted Date', sheet.date || this.selectedDate],
      ['Submitted At', sheet.submittedAt || 'N/A'],
      ['Submitted Amount', String(sheet.submittedAmount || 0)],
      [],
      ['SUMMARY'],
      ['Total Day Sale', String(sheet.totalDaySale || 0)],
      ['Total Expenses', String(sheet.totalExpenses || 0)],
      ['Additional Profit', String(sheet.additionalProfit || 0)],
      ['Grand Total', String(sheet.grandTotal || 0)],
      [],
      ['STOCK / SALES DETAILS'],
      ['Brand', 'Code', 'Size', 'Opening', 'Closing', 'Price', 'Amount', 'Difference', 'Remarks']
    ];

    (sheet.records || []).forEach((record: any) => {
      const sizes = Array.isArray(record.sizes) ? record.sizes : [];
      if (!sizes.length) {
        rows.push([record.brand || '', record.code || '', '', '', '', '', '', String(record.difference || 0), record.remarks || '']);
        return;
      }
      sizes.forEach((size: any) => rows.push([
        record.brand || '', record.code || '', size.size || '', String(size.opening || 0),
        String(size.closing || 0), String(size.price || 0), String(size.amount || 0),
        String(record.difference || 0), record.remarks || ''
      ]));
    });

    rows.push([], ['EXPENSE DETAILS'], ['Expense', 'Value', 'Comment']);
    (sheet.expenses || []).forEach((expense: any) => rows.push([
      expense.name || expense.category || '', String(expense.value ?? expense.amount ?? 0), expense.comment || expense.description || ''
    ]));

    rows.push([], ['ADDITIONAL PROFIT DETAILS'], ['Profit', 'Value', 'Comment']);
    const profitRows = Array.isArray(sheet.additionalProfitRows) ? sheet.additionalProfitRows : [];
    profitRows.forEach((profit: any) => rows.push([profit.name || '', String(profit.value || 0), profit.comment || '']));

    const cash = sheet.cashDetails || {};
    rows.push([], ['CASH SETTLEMENT DETAILS'], ['Cash Deposit', 'PhonePay', 'Bank Challan / Receipt', 'Comments']);
    rows.push([String(cash.cashDeposit || 0), String(cash.phonePay || 0), cash.bankChallanReceipt || '', cash.comments || '']);
    return rows;
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}

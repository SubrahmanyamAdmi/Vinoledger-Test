import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';

@Component({
  selector: 'app-owner-daily-sales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-daily-sales.component.html',
  styleUrls: ['./owner-daily-sales.component.scss']
})
export class OwnerDailySalesComponent {
  today = this.toIsoDate(new Date());
  startDate = '';
  endDate = '';
  dateError = '';
  rangeSelected = false;
  private submissions: any[] = [];
  shop = { name: 'Shop', id: '' };
  ownerName = 'Shop Owner';
  salesRows: Array<{ no: number; date: string; invoice: string; amount: number; expense: number; submission: any }> = [];

  get totalSales(): number {
    return this.salesRows.reduce((sum, row) => sum + row.amount, 0);
  }

  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService) {
    const user = this.auth.currentUser();
    const sessionShop = this.readSessionShop();
    const registeredShop = this.auth.getRegisteredShops().find((item) => item.shopId === user?.shopId);
    this.ownerName = registeredShop?.ownerName || user?.name || sessionShop.owner || 'Shop Owner';
    this.shop = {
      name: registeredShop?.name || (registeredShop?.shopId === 'MH2094' ? 'Manson House' : registeredShop?.shopId) || sessionShop.name || 'Shop',
      id: user?.shopId || registeredShop?.shopId || sessionShop.id || ''
    };
    this.businessData.getDaySheets().subscribe({
      next: (submissions) => this.submissions = submissions.length ? submissions : this.loadSubmissions(),
      error: () => this.submissions = this.loadSubmissions()
    });
  }

  logout() {
    this.auth.logout();
  }

  goBack() {
    this.router.navigate(['/owner']);
  }

  onStartDateChange() {
    if (this.startDate && this.endDate && this.endDate < this.startDate) {
      this.endDate = '';
    }
    this.updateRows();
  }

  onEndDateChange() {
    this.updateRows();
  }

  downloadRow(row: { invoice: string; submission: any }) {
    if (!row?.submission) return;
    this.downloadSubmission(row.submission, row.invoice);
  }

  downloadAll() {
    if (!this.rangeSelected || this.dateError || !this.salesRows.length) return;
    const rows = this.salesRows.flatMap((row) => this.buildSubmissionRows(row.submission));
    this.downloadCsv(rows, `owner-day-sheets-${this.shop.id}-${this.startDate}-${this.endDate}.csv`);
  }

  private updateRows() {
    this.dateError = '';
    this.rangeSelected = Boolean(this.startDate && this.endDate);
    if (!this.rangeSelected) {
      this.salesRows = [];
      return;
    }
    if (this.startDate > this.today || this.endDate > this.today || this.endDate < this.startDate) {
      this.dateError = 'Select a valid range from a past date through today.';
      this.salesRows = [];
      return;
    }
    const filtered = this.submissions
      .filter((submission) => submission.shopId === this.shop.id && submission.date >= this.startDate && submission.date <= this.endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    this.salesRows = filtered.map((submission, index) => ({
      no: index + 1,
      date: this.formatDate(submission.date),
      invoice: `DAY-${submission.date}`,
      amount: Number(submission.grandTotal || 0),
      expense: Number(submission.totalExpenses || 0),
      submission
    }));
  }

  private loadSubmissions(): any[] {
    try {
      const history = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      return Array.isArray(history) ? history.filter((item) => item.shopId === this.shop.id) : [];
    } catch {
      return [];
    }
  }

  private downloadSubmission(submission: any, filename: string) {
    if (!submission) return;
    this.downloadCsv(this.buildSubmissionRows(submission), `${filename || 'day-sheet'}.csv`);
  }

  private buildSubmissionRows(submission: any): string[][] {
    const rows: string[][] = [
      ['VinoLedger Day Sheet'], ['Shop', submission.shop?.name || this.shop.name], ['Shop ID', submission.shopId || this.shop.id],
      ['Owner', submission.shop?.owner || this.auth.currentUser()?.name || ''], ['Submitted Date', submission.date || ''],
      ['Submitted At', submission.submittedAt || ''], ['Submitted Amount', String(submission.submittedAmount || 0)], [],
      ['SUMMARY'], ['Total Sales', String(submission.totalDaySale || 0)], ['Total Expenses', String(submission.totalExpenses || 0)],
      ['Additional Profit', String(submission.additionalProfit || 0)], ['Grand Total', String(submission.grandTotal || 0)], [],
      ['STOCK / SALES DETAILS'], ['Brand', 'Code', 'Size', 'Opening', 'Closing', 'Price', 'Amount', 'Difference', 'Remarks']
    ];
    (submission.records || []).forEach((record: any) => (record.sizes || []).forEach((size: any) => rows.push([
      record.brand || '', record.code || '', size.size || '', String(size.opening || 0), String(size.closing || 0),
      String(size.price || 0), String(size.amount || 0), String(record.difference || 0), record.remarks || ''
    ])));
    rows.push([], ['EXPENSE DETAILS'], ['Expense', 'Value', 'Comment']);
    (submission.expenses || []).forEach((item: any) => rows.push([item.name || '', String(item.value || 0), item.comment || '']));
    rows.push([], ['ADDITIONAL PROFIT DETAILS'], ['Profit', 'Value', 'Comment']);
    (submission.additionalProfitRows || []).forEach((item: any) => rows.push([item.name || '', String(item.value || 0), item.comment || '']));
    const cash = submission.cashDetails || {};
    rows.push([], ['CASH SETTLEMENT DETAILS'], ['Cash Deposit', 'PhonePay', 'Bank Challan / Receipt', 'Comments'], [
      String(cash.cashDeposit || 0), String(cash.phonePay || 0), cash.bankChallanReceipt || '', cash.comments || ''
    ]);
    return rows;
  }

  private downloadCsv(rows: string[][], filename: string) {
    if (!rows.length) return;
    const csv = rows.map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private readSessionShop(): { id?: string; name?: string; owner?: string } {
    try { return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}'); } catch { return {}; }
  }

  private formatDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private toIsoDate(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}

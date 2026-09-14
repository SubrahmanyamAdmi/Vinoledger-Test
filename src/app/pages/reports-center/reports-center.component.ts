import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reports-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-center.component.html',
  styleUrls: ['./reports-center.component.scss']
})
export class ReportsCenterComponent {
  today = this.toIsoDate(new Date());
  startDate = '';
  endDate = '';
  reportType = '';
  dateError = '';
  rangeSelected = false;
  reportReady = false;
  ownerName = 'Shop Owner';
  shopId = '';
  private submissions: any[] = [];
  filteredSubmissions: any[] = [];

  weeklyBars: number[] = [];
  weeks: string[] = [];

  categoryData: Array<{ label: string; value: number; color: string }> = [];

  constructor(public auth: AuthService, private router: Router) {
    const user = this.auth.currentUser();
    this.shopId = user?.shopId || this.readSessionShop().id || '';
    this.ownerName = user?.name || this.readSessionShop().owner || 'Shop Owner';
    this.submissions = this.loadSubmissions();
  }

  get totalSales() {
    return this.filteredSubmissions.reduce((sum, item) => sum + Number(item.totalDaySale || 0), 0);
  }

  get totalExpenses() {
    return this.filteredSubmissions.reduce((sum, item) => sum + Number(item.totalExpenses || 0), 0);
  }

  get totalProfit() {
    return this.filteredSubmissions.reduce((sum, item) => sum + Number(item.additionalProfit || 0), 0);
  }

  get grandTotal() {
    return this.filteredSubmissions.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
  }

  get profitMargin() {
    return this.totalSales ? (this.totalProfit / this.totalSales) * 100 : 0;
  }

  get primaryTotal() {
    if (this.reportType === 'Expense Report') return this.totalExpenses;
    if (this.reportType === 'Stock Report') return this.totalStockUnits;
    return this.totalSales;
  }

  get primaryLabel() {
    if (this.reportType === 'Expense Report') return 'Total Expenses';
    if (this.reportType === 'Stock Report') return 'Total Bottles';
    return 'Total Sales';
  }

  get secondaryTotal() {
    if (this.reportType === 'Expense Report') return this.filteredSubmissions.length;
    if (this.reportType === 'Stock Report') return this.totalStockBrands;
    return this.grandTotal;
  }

  get secondaryLabel() {
    if (this.reportType === 'Expense Report') return 'Submitted Sheets';
    if (this.reportType === 'Stock Report') return 'Brands';
    return 'Grand Total';
  }

  get totalStockUnits() {
    return this.filteredSubmissions.reduce((sum, submission) => sum + (submission.records || []).reduce((recordSum: number, record: any) =>
      recordSum + (record.sizes || []).reduce((sizeSum: number, size: any) => sizeSum + Number(size.closing || 0), 0), 0), 0);
  }

  get totalStockBrands() {
    return new Set(this.filteredSubmissions.flatMap((submission) => (submission.records || []).map((record: any) => record.brand))).size;
  }

  onStartDateChange() {
    if (this.endDate && this.endDate < this.startDate) this.endDate = '';
    this.updateReport();
  }

  onEndDateChange() {
    this.updateReport();
  }

  onReportTypeChange() {
    this.updateReport();
  }

  private updateReport() {
    this.dateError = '';
    this.rangeSelected = Boolean(this.startDate && this.endDate);
    this.reportReady = false;
    if (!this.rangeSelected) return;
    if (this.startDate > this.today || this.endDate > this.today || this.endDate < this.startDate) {
      this.dateError = 'Select a valid range from a past date through today.';
      return;
    }
    this.filteredSubmissions = this.submissions.filter((item) =>
      item.date >= this.startDate && item.date <= this.endDate
    );
    this.reportReady = Boolean(this.reportType);
    this.buildAnalysis();
  }

  private buildAnalysis() {
    const daily = new Map<string, number>();
    const categories = new Map<string, number>();
    this.filteredSubmissions.forEach((submission) => {
      const dailyValue = this.reportType === 'Expense Report'
        ? Number(submission.totalExpenses || 0)
        : this.reportType === 'Stock Report'
          ? (submission.records || []).reduce((sum: number, record: any) => sum + (record.sizes || []).reduce((sizeSum: number, size: any) => sizeSum + Number(size.closing || 0), 0), 0)
          : Number(submission.totalDaySale || 0);
      daily.set(submission.date, (daily.get(submission.date) || 0) + dailyValue);
      if (this.reportType === 'Expense Report') {
        (submission.expenses || []).forEach((expense: any) => {
          const label = expense.name || expense.category || 'Other';
          categories.set(label, (categories.get(label) || 0) + Number(expense.value ?? expense.amount ?? 0));
        });
      } else {
        (submission.records || []).forEach((record: any) => {
          const label = this.reportType === 'Stock Report' ? (record.brand || 'Other') : this.categoryFor(record.brand);
          const value = this.reportType === 'Stock Report'
            ? (record.sizes || []).reduce((sum: number, size: any) => sum + Number(size.closing || 0), 0)
            : this.recordTotal(record);
          categories.set(label, (categories.get(label) || 0) + value);
        });
      }
    });
    const dailyValues = Array.from(daily.entries()).sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(...dailyValues.map(([, value]) => value), 1);
    this.weeks = dailyValues.map(([date]) => this.shortDate(date));
    this.weeklyBars = dailyValues.map(([, value]) => Math.max(8, Math.round((value / max) * 100)));
    const total = Array.from(categories.values()).reduce((sum, value) => sum + value, 0) || 1;
    this.categoryData = Array.from(categories.entries()).map(([label, value], index) => ({
      label, value: Math.round((value / total) * 100), color: ['#f39a46', '#2db7d9', '#34c38f', '#1d1d1d'][index % 4]
    }));
  }

  private loadSubmissions(): any[] {
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      return Array.isArray(saved) ? saved.filter((item) => String(item.shopId || '').toUpperCase() === this.shopId.toUpperCase()) : [];
    } catch { return []; }
  }

  private recordTotal(record: any) {
    return (record.sizes || []).reduce((sum: number, size: any) => sum + Number(size.amount || 0), 0);
  }

  private categoryFor(brand: string) {
    const value = String(brand || '').toLowerCase();
    if (value.includes('beer')) return 'Beer';
    if (value.includes('wine')) return 'Wine';
    if (value.includes('whisky') || value.includes('whiskey') || value.includes('stag')) return 'Whisky';
    return 'Other';
  }

  private shortDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private toIsoDate(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private readSessionShop(): { id?: string; owner?: string } {
    try { return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}'); } catch { return {}; }
  }

  downloadReport() {
    const rows = [['Report Type', this.reportType], ['Owner', this.ownerName], ['Shop ID', this.shopId], ['Start Date', this.startDate], ['End Date', this.endDate], [], ['Date', 'Sales', 'Expenses', 'Profit', 'Grand Total']];
    this.filteredSubmissions.forEach((item) => rows.push([item.date, String(item.totalDaySale || 0), String(item.totalExpenses || 0), String(item.additionalProfit || 0), String(item.grandTotal || 0)]));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `report-${this.shopId}-${this.startDate}-${this.endDate}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  goBack() {
    this.router.navigate(['/owner']);
  }

  logout() {
    this.auth.logout();
  }
}

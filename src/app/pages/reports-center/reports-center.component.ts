import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppDateInputComponent } from '../../shared/date-input/date-input.component';

type Period = 'Yesterday' | 'This Month' | 'This Year' | 'Custom';

const LOW_STOCK_THRESHOLD = 10;
const BRAND_COLORS = ['#1d1d1d', '#2db7d9', '#f39a46', '#34c38f', '#a35ce8', '#e85c7a', '#5c6bc0', '#ff8a65', '#26a69a', '#8d6e63'];

@Component({
  selector: 'app-reports-center',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppDateInputComponent],
  templateUrl: './reports-center.component.html',
  styleUrls: ['./reports-center.component.scss']
})
export class ReportsCenterComponent {
  today = this.toIsoDate(new Date());
  startDate = '';
  endDate = '';
  dateError = '';
  ownerName = 'Shop Owner';
  shopName = '';
  shopId = '';
  openingDate = '';
  period: Period = 'Yesterday';
  periods: Period[] = ['Yesterday', 'This Month', 'This Year', 'Custom'];

  private submissions: any[] = [];
  periodSubmissions: any[] = [];

  trendLabels: string[] = [];
  trendCaption = '';
  trendPoints = '';
  trendDots: Array<{ x: number; y: number; value: number }> = [];
  trendYAxis: Array<{ y: number; label: string }> = [];
  trendLabelX: Array<{ x: number; label: string }> = [];
  trendViewBox = '0 0 640 220';

  topBrands: Array<{ label: string; bottles: number; sales: number; pct: number; color: string }> = [];

  stockRows: Array<{ brand: string; size: string; opening: number; sold: number; closing: number; salesAmount: number; status: 'in' | 'low' | 'out' }> = [];
  stockDate = '';

  constructor(public auth: AuthService, private router: Router) {
    const user = this.auth.currentUser();
    const sessionShop = this.readSessionShop();
    this.shopId = user?.shopId || sessionShop.id || '';
    const registeredShop = this.auth.getRegisteredShops().find((shop) => shop.shopId === this.shopId);
    this.shopName = sessionShop.name || registeredShop?.name || this.shopId;
    this.ownerName = user?.name || sessionShop.owner || registeredShop?.ownerName || 'Shop Owner';
    this.openingDate = String(sessionShop.openingDate || sessionShop.createdAt || '').slice(0, 10);
    this.submissions = this.loadSubmissions();
    this.buildDashboard();
  }

  // --- Top summary cards (fixed reference points, independent of the period selector) ---

  get todaysSubmission() {
    return this.submissions.find((item) => item.date === this.today);
  }

  get yesterdaysSubmission() {
    const yesterday = new Date(`${this.today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    return this.submissions.find((item) => item.date === this.toIsoDate(yesterday));
  }

  get yesterdaySales() {
    return Number(this.yesterdaysSubmission?.totalDaySale || 0);
  }

  get todayBottlesSold() {
    return this.bottlesSold(this.todaysSubmission ? [this.todaysSubmission] : []);
  }

  get yesterdayBottlesSold() {
    return this.bottlesSold(this.yesterdaysSubmission ? [this.yesterdaysSubmission] : []);
  }

  get currentMonthSubmissions() {
    const monthPrefix = this.today.slice(0, 7);
    return this.submissions.filter((item) => String(item.date || '').startsWith(monthPrefix));
  }

  get monthlySales() {
    return this.currentMonthSubmissions.reduce((sum, item) => sum + Number(item.totalDaySale || 0), 0);
  }

  get monthlyProfit() {
    return this.currentMonthSubmissions.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
  }

  get currentStockValue() {
    return this.stockRows.reduce((sum, row) => sum + row.closing * this.stockRowPrice(row), 0);
  }

  get lowStockCount() {
    return this.stockRows.filter((row) => row.status === 'low').length;
  }

  get outOfStockCount() {
    return this.stockRows.filter((row) => row.status === 'out').length;
  }

  get inStockCount() {
    return this.stockRows.filter((row) => row.status === 'in').length;
  }

  private priceByKey = new Map<string, number>();

  private stockRowPrice(row: { brand: string; size: string }) {
    return this.priceByKey.get(`${this.normalize(row.brand)}|${row.size}`) || 0;
  }

  // --- Period selection ---

  setPeriod(period: Period) {
    this.period = period;
    this.dateError = '';
    this.buildDashboard();
  }

  onStartDateChange() {
    if (this.endDate && this.endDate < this.startDate) this.endDate = '';
    this.buildDashboard();
  }

  onEndDateChange() {
    this.buildDashboard();
  }

  private buildDashboard() {
    this.dateError = '';
    this.periodSubmissions = this.getPeriodSubmissions();
    this.buildTrend();
    this.buildTopBrands();
    this.buildStockTable();
  }

  private getPeriodSubmissions(): any[] {
    if (this.period === 'Yesterday') {
      const yesterday = new Date(`${this.today}T00:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = this.toIsoDate(yesterday);
      return this.submissions.filter((item) => item.date === yesterdayDate);
    }
    if (this.period === 'This Month') {
      return this.currentMonthSubmissions;
    }
    if (this.period === 'This Year') {
      const yearPrefix = this.today.slice(0, 4);
      return this.submissions.filter((item) => String(item.date || '').startsWith(yearPrefix));
    }

    if (!this.startDate || !this.endDate) return [];
    if (this.startDate > this.today || this.endDate > this.today || this.endDate < this.startDate) {
      this.dateError = 'Select a valid range from a past date through today.';
      return [];
    }
    return this.submissions.filter((item) => item.date >= this.startDate && item.date <= this.endDate);
  }

  // --- Sales trend chart ---

  private buildTrend() {
    if (this.period === 'This Year') {
      const monthlyTotals = new Array(12).fill(0);
      this.periodSubmissions.forEach((item) => {
        const month = Number(String(item.date || '').slice(5, 7)) - 1;
        if (month >= 0 && month < 12) monthlyTotals[month] += Number(item.totalDaySale || 0);
      });
      this.trendLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      this.trendCaption = 'Monthly sales trend for this year';
      this.buildTrendChart(monthlyTotals);
      return;
    }

    const daily = new Map<string, number>();
    this.periodSubmissions.forEach((item) => {
      daily.set(item.date, (daily.get(item.date) || 0) + Number(item.totalDaySale || 0));
    });
    const entries = Array.from(daily.entries()).sort(([a], [b]) => a.localeCompare(b));
    this.trendLabels = entries.map(([date]) => this.shortDate(date));
    this.trendCaption = this.period === 'Yesterday'
      ? "Yesterday's sales"
      : this.period === 'This Month'
        ? 'Daily sales trend for this month'
        : 'Sales by date for the selected range';
    this.buildTrendChart(entries.map(([, value]) => value));
  }

  private buildTrendChart(values: number[]) {
    const width = 640;
    const height = 220;
    const paddingLeft = 56;
    const paddingRight = 16;
    const paddingTop = 16;
    const paddingBottom = 30;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const max = Math.max(...values, 1);
    const step = values.length > 1 ? plotWidth / (values.length - 1) : 0;

    this.trendPoints = values.map((value, index) => {
      const x = paddingLeft + step * index;
      const y = paddingTop + plotHeight - (value / max) * plotHeight;
      return `${x},${y}`;
    }).join(' ');

    this.trendDots = values.map((value, index) => ({
      x: paddingLeft + step * index,
      y: paddingTop + plotHeight - (value / max) * plotHeight,
      value
    }));

    const gridLineCount = 4;
    this.trendYAxis = Array.from({ length: gridLineCount + 1 }, (_, i) => {
      const value = (max / gridLineCount) * (gridLineCount - i);
      return { y: paddingTop + (plotHeight / gridLineCount) * i, label: this.formatAxisValue(value) };
    });

    this.trendLabelX = this.trendLabels.map((label, index) => ({ x: paddingLeft + step * index, label }));
    this.trendViewBox = `0 0 ${width} ${height}`;
  }

  private formatAxisValue(value: number) {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
    return `₹${Math.round(value)}`;
  }

  // --- Top selling brands ---

  private buildTopBrands() {
    const totals = new Map<string, { bottles: number; sales: number }>();
    this.periodSubmissions.forEach((submission) => {
      (submission.records || []).forEach((record: any) => {
        const label = record.brand || 'Other';
        const entry = totals.get(label) || { bottles: 0, sales: 0 };
        (record.sizes || []).forEach((size: any) => {
          entry.bottles += Number(size.sales || 0);
          entry.sales += Number(size.amount || 0);
        });
        totals.set(label, entry);
      });
    });

    const ranked = Array.from(totals.entries())
      .filter(([, value]) => value.bottles > 0 || value.sales > 0)
      .sort(([, a], [, b]) => b.sales - a.sales)
      .slice(0, 10);
    const max = Math.max(...ranked.map(([, value]) => value.sales), 1);
    this.topBrands = ranked.map(([label, value], index) => ({
      label,
      bottles: value.bottles,
      sales: value.sales,
      pct: Math.max(4, Math.round((value.sales / max) * 100)),
      color: BRAND_COLORS[index % BRAND_COLORS.length]
    }));
  }

  // --- Stock status + table (based on the most recent submitted day sheet) ---

  private buildStockTable() {
    const latest = [...this.submissions].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    this.stockDate = latest?.date || '';
    this.priceByKey.clear();
    this.stockRows = [];

    (latest?.records || []).forEach((record: any) => {
      (record.sizes || []).forEach((size: any) => {
        const closing = Number(size.closing || 0);
        const status: 'in' | 'low' | 'out' = closing === 0 ? 'out' : closing <= LOW_STOCK_THRESHOLD ? 'low' : 'in';
        this.priceByKey.set(`${this.normalize(record.brand)}|${size.size}`, Number(size.price || 0));
        this.stockRows.push({
          brand: record.brand || '',
          size: size.size,
          opening: Number(size.opening || 0),
          sold: Number(size.sales || 0),
          closing,
          salesAmount: Number(size.amount || 0),
          status
        });
      });
    });
  }

  private bottlesSold(submissions: any[]) {
    return submissions.reduce((sum, submission) => sum + (submission.records || []).reduce((recordSum: number, record: any) =>
      recordSum + (record.sizes || []).reduce((sizeSum: number, size: any) => sizeSum + Number(size.sales || 0), 0), 0), 0);
  }

  private loadSubmissions(): any[] {
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      return Array.isArray(saved) ? saved.filter((item) => String(item.shopId || '').toUpperCase() === this.shopId.toUpperCase()) : [];
    } catch { return []; }
  }

  private normalize(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private shortDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private toIsoDate(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private readSessionShop(): { id?: string; name?: string; owner?: string; openingDate?: string; createdAt?: string } {
    try { return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}'); } catch { return {}; }
  }

  downloadReport() {
    const rows = [
      ['Owner', this.ownerName], ['Shop ID', this.shopId], ['Period', this.period],
      ['Start Date', this.startDate], ['End Date', this.endDate], [],
      ['Date', 'Sales', 'Expenses', 'Profit', 'Grand Total']
    ];
    this.periodSubmissions.forEach((item) => rows.push([item.date, String(item.totalDaySale || 0), String(item.totalExpenses || 0), String(item.additionalProfit || 0), String(item.grandTotal || 0)]));
    rows.push([]);
    rows.push(['Brand', 'Size', 'Opening', 'Sold', 'Closing', 'Sales Value']);
    this.stockRows.forEach((row) => rows.push([row.brand, row.size, String(row.opening), String(row.sold), String(row.closing), String(row.salesAmount)]));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `report-${this.shopId}-${this.period}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  goBack() {
    this.router.navigate(['/owner']);
  }

  logout() {
    this.auth.logout();
  }
}

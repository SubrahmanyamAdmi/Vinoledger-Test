import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { BusinessDataService } from '../../services/business-data.service';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppSelectComponent, AppSelectOption } from '../../shared/select/select.component';

type StockStatus = 'out' | 'critical' | 'reorder' | 'monitor' | 'healthy';

interface ReorderRow {
  brand: string;
  code: string;
  size: string;
  sizeMl: number;
  bottlesPerCase: number;
  currentStock: number;
  avgDailySale: number;
  daysLeft: number;
  status: StockStatus;
  price: number;
  suggestedBottles: number;
  suggestedCases: number;
  approvedCases: number;
  reason: string;
}

const STATUS_ORDER: StockStatus[] = ['out', 'critical', 'reorder', 'monitor', 'healthy'];
const STATUS_LABEL: Record<StockStatus, string> = {
  out: 'Out of Stock',
  critical: 'Critical',
  reorder: 'Reorder Soon',
  monitor: 'Monitor',
  healthy: 'Healthy'
};

@Component({
  selector: 'app-generate-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppSelectComponent],
  templateUrl: './generate-invoice.component.html',
  styleUrls: ['./generate-invoice.component.scss']
})
export class GenerateInvoiceComponent {
  shop: { id?: string; owner?: string; name?: string } = {};
  shopId = '';
  ownerName = 'Shop Owner';

  periodDays = 30;
  periodOptions = [7, 30, 90];
  targetStockDays = 15;
  targetStockOptions = [7, 15, 30];

  get periodSelectOptions(): AppSelectOption[] {
    return this.periodOptions.map((value) => ({ value, label: `Last ${value} Days` }));
  }

  get targetStockSelectOptions(): AppSelectOption[] {
    return this.targetStockOptions.map((value) => ({ value, label: `${value} Days` }));
  }

  rows: ReorderRow[] = [];
  statusLabel = STATUS_LABEL;

  poDialogOpen = false;
  depotName = '';
  poError = '';
  poSuccessOpen = false;
  lastPoNumber = '';
  isSaving = false;

  private submissions: any[] = [];

  constructor(public auth: AuthService, private router: Router, private firestore: FirestoreService, private businessData: BusinessDataService) {
    this.shop = this.readSessionShop();
    const user = this.auth.currentUser();
    this.shopId = user?.shopId || this.shop.id || '';
    this.ownerName = user?.name || this.shop.owner || 'Shop Owner';
    this.submissions = this.loadSubmissions();
    this.buildRecommendations();
    this.businessData.getDaySheets().subscribe({
      next: (remoteSubmissions) => {
        this.submissions = this.mergeSubmissions(remoteSubmissions);
        this.buildRecommendations();
      },
      error: () => undefined
    });
  }

  get actionableRows() {
    return this.rows.filter((row) => row.status !== 'healthy');
  }

  get outOfStockCount() {
    return this.rows.filter((row) => row.status === 'out').length;
  }

  get criticalCount() {
    return this.rows.filter((row) => row.status === 'critical').length;
  }

  get reorderSoonCount() {
    return this.rows.filter((row) => row.status === 'reorder').length;
  }

  get monitorCount() {
    return this.rows.filter((row) => row.status === 'monitor').length;
  }

  get totalSuggestedCases() {
    return this.rows.reduce((sum, row) => sum + Math.max(0, Number(row.approvedCases) || 0), 0);
  }

  get totalSuggestedBottles() {
    return this.rows.reduce((sum, row) => sum + Math.max(0, Number(row.approvedCases) || 0) * row.bottlesPerCase, 0);
  }

  isInfinite(value: number) {
    return !Number.isFinite(value);
  }

  onPeriodChange() {
    this.buildRecommendations();
  }

  onTargetDaysChange() {
    this.buildRecommendations();
  }

  resetApprovedCases(row: ReorderRow) {
    row.approvedCases = row.suggestedCases;
  }

  openPoDialog() {
    this.depotName = '';
    this.poError = '';
    this.poDialogOpen = true;
  }

  closePoDialog() {
    this.poDialogOpen = false;
  }

  async generatePurchaseOrder() {
    if (!this.depotName.trim()) {
      this.poError = 'Enter the depot name to generate the purchase order.';
      return;
    }

    const items = this.rows.filter((row) => Math.max(0, Number(row.approvedCases) || 0) > 0);
    if (!items.length) {
      this.poError = 'No items have an approved order quantity.';
      return;
    }

    this.isSaving = true;
    const poNumber = this.generatePoNumber();
    const order = {
      poNumber,
      date: this.toIsoDate(new Date()),
      shopId: this.shopId,
      depot: this.depotName.trim(),
      requestedBy: this.ownerName,
      totalCases: items.reduce((sum, row) => sum + Number(row.approvedCases || 0), 0),
      totalUnits: items.reduce((sum, row) => sum + Number(row.approvedCases || 0) * row.bottlesPerCase, 0),
      items: items.map((row) => ({
        brand: row.brand, code: row.code, size: row.size, bottlesPerCase: row.bottlesPerCase,
        cases: row.approvedCases, units: row.approvedCases * row.bottlesPerCase, mrp: row.price, reason: row.reason
      })),
      createdAt: new Date().toISOString()
    };

    try {
      this.savePurchaseOrderLocally(order);
      if (this.isFirebaseConfigured()) {
        await this.firestore.createDocument('purchaseOrders', order);
      }
      this.downloadPurchaseOrder(order);
      this.lastPoNumber = poNumber;
      this.poDialogOpen = false;
      this.poSuccessOpen = true;
    } catch {
      this.poError = 'Unable to generate the purchase order. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  closeSuccessDialog() {
    this.poSuccessOpen = false;
  }

  goBack() {
    this.router.navigate(['/owner']);
  }

  logout() {
    this.auth.logout();
  }

  // --- Reorder engine ---

  private buildRecommendations() {
    const today = this.toIsoDate(new Date());
    const periodStart = this.toIsoDate(new Date(Date.now() - this.periodDays * 24 * 60 * 60 * 1000));
    const periodSubmissions = this.submissions.filter((item) => item.date >= periodStart && item.date <= today);
    const salesDays = new Set(periodSubmissions.map((item) => item.date)).size || 1;

    const latest = [...this.submissions].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    const bottlesPerCaseMap = this.loadBottlesPerCaseMap();

    const totalsByKey = new Map<string, { brand: string; code: string; size: string; sold: number; price: number }>();
    periodSubmissions.forEach((submission) => {
      (submission.records || []).forEach((record: any) => {
        (record.sizes || []).forEach((size: any) => {
          const key = `${this.normalize(record.code)}|${this.normalize(record.brand)}|${size.size}`;
          const entry = totalsByKey.get(key) || { brand: record.brand || '', code: record.code || '', size: size.size, sold: 0, price: Number(size.price || 0) };
          entry.sold += Number(size.sales || 0);
          entry.price = Number(size.price || entry.price || 0);
          totalsByKey.set(key, entry);
        });
      });
    });

    const currentStockByKey = new Map<string, { closing: number; price: number }>();
    (latest?.records || []).forEach((record: any) => {
      (record.sizes || []).forEach((size: any) => {
        const key = `${this.normalize(record.code)}|${this.normalize(record.brand)}|${size.size}`;
        currentStockByKey.set(key, { closing: Number(size.closing || 0), price: Number(size.price || 0) });
        if (!totalsByKey.has(key)) {
          totalsByKey.set(key, { brand: record.brand || '', code: record.code || '', size: size.size, sold: 0, price: Number(size.price || 0) });
        }
      });
    });

    this.rows = Array.from(totalsByKey.entries()).map(([key, value]) => {
      const stock = currentStockByKey.get(key);
      const currentStock = stock?.closing || 0;
      const avgDailySale = value.sold / salesDays;
      const daysLeft = avgDailySale > 0 ? currentStock / avgDailySale : (currentStock > 0 ? Infinity : 0);
      const status = this.classifyStatus(currentStock, daysLeft);
      const targetStockBottles = avgDailySale * this.targetStockDays;
      const suggestedBottles = Math.max(0, Math.round(targetStockBottles - currentStock));
      const bottlesPerCase = bottlesPerCaseMap.get(`${this.normalize(value.code)}|${this.parseSizeMl(value.size)}`) || 1;
      const suggestedCases = suggestedBottles > 0 ? Math.ceil(suggestedBottles / bottlesPerCase) : 0;

      return {
        brand: value.brand,
        code: value.code,
        size: value.size,
        sizeMl: this.parseSizeMl(value.size),
        bottlesPerCase,
        currentStock,
        avgDailySale: Math.round(avgDailySale * 10) / 10,
        daysLeft: Number.isFinite(daysLeft) ? Math.round(daysLeft * 10) / 10 : Infinity,
        status,
        price: stock?.price || value.price || 0,
        suggestedBottles,
        suggestedCases,
        approvedCases: suggestedCases,
        reason: this.reasonFor(status, avgDailySale, daysLeft, currentStock)
      };
    }).sort((a, b) => {
      const statusDiff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (statusDiff !== 0) return statusDiff;
      return a.daysLeft - b.daysLeft;
    });
  }

  private classifyStatus(currentStock: number, daysLeft: number): StockStatus {
    if (currentStock <= 0) return 'out';
    if (daysLeft <= 3) return 'critical';
    if (daysLeft <= 7) return 'reorder';
    if (daysLeft <= 15) return 'monitor';
    return 'healthy';
  }

  private reasonFor(status: StockStatus, avgDailySale: number, daysLeft: number, currentStock: number) {
    if (status === 'out') return currentStock <= 0 && avgDailySale > 0 ? 'Out of stock + high demand' : 'Out of stock';
    if (status === 'critical') return `High sales + ${Number.isFinite(daysLeft) ? daysLeft.toFixed(1) : '0'} days stock left`;
    if (status === 'reorder') return `${Number.isFinite(daysLeft) ? daysLeft.toFixed(1) : '0'} days stock remaining`;
    if (status === 'monitor') return `${Number.isFinite(daysLeft) ? daysLeft.toFixed(1) : '0'} days stock, keep monitoring`;
    return 'Healthy stock level';
  }

  private loadBottlesPerCaseMap(): Map<string, number> {
    const map = new Map<string, number>();
    try {
      const settings = JSON.parse(localStorage.getItem(`vinoledger.invoice.brand-settings.${this.shopId}`) || '[]');
      (Array.isArray(settings) ? settings : []).forEach((setting: any) => {
        const sizeMl = Number(setting.size || 0);
        if (setting.code && sizeMl && setting.bottlesPerCase) {
          map.set(`${this.normalize(setting.code)}|${sizeMl}`, Number(setting.bottlesPerCase));
        }
      });
    } catch { /* Ignore malformed brand settings and fall back to 1 bottle per case. */ }
    return map;
  }

  private loadSubmissions(): any[] {
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      return Array.isArray(saved) ? saved.filter((item) => String(item.shopId || '').toUpperCase() === this.shopId.toUpperCase()) : [];
    } catch { return []; }
  }

  private mergeSubmissions(remoteSubmissions: any[]) {
    const byDate = new Map<string, any>();
    [...this.submissions, ...(Array.isArray(remoteSubmissions) ? remoteSubmissions : [])]
      .filter((item) => String(item.shopId || item.shop?.id || '').toUpperCase() === this.shopId.toUpperCase())
      .forEach((item) => byDate.set(String(item.date || '').slice(0, 10), item));
    return [...byDate.values()];
  }

  private savePurchaseOrderLocally(order: Record<string, unknown>) {
    const key = `vinoledger.purchaseOrders.${this.shopId}`;
    let existing: Record<string, unknown>[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      existing = Array.isArray(saved) ? saved : [];
    } catch { existing = []; }
    localStorage.setItem(key, JSON.stringify([...existing, order]));
  }

  private downloadPurchaseOrder(order: any) {
    const lines: string[] = [];
    lines.push('=================================================='.slice(0, 50));
    lines.push(`${(this.shop.name || this.ownerName || 'WINE SHOP').toUpperCase()}`);
    lines.push('PURCHASE ORDER');
    lines.push('');
    lines.push(`PO Number: ${order.poNumber}`);
    lines.push(`Date: ${order.date}`);
    lines.push(`Depot: ${order.depot}`);
    lines.push('');
    lines.push('S.No | Brand | Size | Cases | Units | MRP | Reason');
    order.items.forEach((item: any, index: number) => {
      lines.push(`${index + 1} | ${item.brand} | ${item.size} | ${item.cases} | ${item.units} | Rs.${item.mrp} | ${item.reason}`);
    });
    lines.push('');
    lines.push(`Total Cases: ${order.totalCases}`);
    lines.push(`Total Units: ${order.totalUnits}`);
    lines.push('');
    lines.push('Reason: Stock replenishment based on recent sales and current inventory levels.');
    lines.push('');
    lines.push(`Requested By: ${order.requestedBy}`);
    lines.push('Approved By: __________');
    const text = lines.join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    link.download = `${order.poNumber}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private generatePoNumber() {
    const year = new Date().getFullYear();
    const key = `vinoledger.purchaseOrders.${this.shopId}`;
    let count = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      count = Array.isArray(saved) ? saved.length : 0;
    } catch { count = 0; }
    return `PO-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private isFirebaseConfigured() {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.appId && config.projectId &&
      config.apiKey !== 'YOUR_API_KEY' && config.projectId !== 'YOUR_PROJECT_ID');
  }

  private parseSizeMl(size: string) {
    return Number(String(size).replace(/[^0-9.]/g, '')) || 0;
  }

  private normalize(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private toIsoDate(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private readSessionShop(): { id?: string; owner?: string; name?: string } {
    try { return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}'); } catch { return {}; }
  }
}

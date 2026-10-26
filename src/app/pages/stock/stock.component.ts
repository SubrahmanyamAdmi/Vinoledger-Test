import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppLoaderComponent } from '../../shared/loader/app-loader.component';

type StockRow = {
  serial: number;
  brand: string;
  code: string;
  size: string;
  mrp: number;
  stock: number;
  cost: number;
};

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, IconComponent, AppLoaderComponent],
  templateUrl: './stock.component.html',
  styleUrls: ['./stock.component.scss']
})
export class StockComponent {
  shopId = '';
  shopName = 'Assigned Shop';
  stockDate = '';
  stockRows: StockRow[] = [];
  totalStockCost = 0;
  isLoading = true;

  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService) {
    const user = this.auth.currentUser();
    const sessionShop = this.readSessionShop();
    const registeredShop = this.auth.getRegisteredShops().find((shop) => shop.shopId === user?.shopId || shop.id === user?.shopId);

    this.shopId = user?.shopId || sessionShop.id || registeredShop?.shopId || '';
    this.shopName = registeredShop?.name || sessionShop.name || 'Assigned Shop';
    this.loadCurrentStock();
  }

  goBack() {
    const role = this.auth.currentUser()?.role;
    this.router.navigate([role === 'Owner' ? '/owner' : '/cashier-home']);
  }

  logout() {
    this.auth.logout();
  }

  downloadPdf() {
    if (!this.stockRows.length) {
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 52;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('VinoLedger Stock Report', margin, y);
    y += 26;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Shop: ${this.shopName}${this.shopId ? ` (${this.shopId})` : ''}`, margin, y);
    y += 16;
    doc.text(`Date: ${this.stockDate || 'N/A'}`, margin, y);
    y += 24;

    const headers = ['S.No', 'Code', 'Brand Name', 'MR Size', 'MRP', 'Stock', 'Cost'];
    const widths = [42, 120, 60, 60, 60, 44, 56];
    let x = margin;

    doc.setFont('helvetica', 'bold');
    headers.forEach((header, index) => {
      doc.text(header, x, y);
      x += widths[index];
    });
    y += 18;

    doc.setFont('helvetica', 'normal');
    this.stockRows.forEach((row) => {
      x = margin;
      const values = [
        String(row.serial),
        row.code || 'N/A',
        row.brand || 'N/A',
        row.size || 'N/A',
        this.formatCurrency(row.mrp),
        String(row.stock),
        this.formatCurrency(row.cost)
      ];

      values.forEach((value, index) => {
        const truncated = this.truncateText(value, widths[index] / 6.5);
        doc.text(truncated, x, y);
        x += widths[index];
      });

      y += 16;
      if (y > 760) {
        doc.addPage();
        y = 52;
      }
    });

    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Stock Cost', margin, y);
    doc.text(this.formatCurrency(this.totalStockCost), pageWidth - margin - 70, y, { align: 'right' });

    doc.save(`${this.shopName.toLowerCase().replace(/\s+/g, '-') || 'stock'}-stock-report.pdf`);
  }

  private loadCurrentStock() {
    const localSubmissions = this.loadSubmissions();
    this.applyLatestSubmission(localSubmissions);
    this.businessData.getDaySheets().subscribe({
      next: (remoteSubmissions) => {
        const hasSubmission = this.applyLatestSubmission([
          ...localSubmissions,
          ...(Array.isArray(remoteSubmissions) ? remoteSubmissions : [])
        ]);
        if (hasSubmission) {
          this.isLoading = false;
          return;
        }
        void this.loadOpeningStockFallback().finally(() => this.isLoading = false);
      },
      error: () => void this.loadOpeningStockFallback().finally(() => this.isLoading = false)
    });
  }

  private applyLatestSubmission(submissions: any[]): boolean {
    const latest = [...submissions].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (!latest) {
      return false;
    }

    this.stockDate = latest.date || '';
    const rows: StockRow[] = [];

    (latest.records || []).forEach((record: any) => {
      (record.sizes || []).forEach((size: any) => {
        const quantity = Number(size.closing ?? size.opening ?? 0);
        const mrp = Number(size.price ?? size.mrp ?? 0);
        if (quantity <= 0) {
          return;
        }

        const cost = quantity * mrp;
        rows.push({
          serial: rows.length + 1,
          brand: String(record.brand || '').trim(),
          code: String(record.code || '').trim(),
          size: String(size.size || size.sizeMl || '').trim() || 'N/A',
          mrp,
          stock: quantity,
          cost
        });
      });
    });

    this.stockRows = rows;
    this.totalStockCost = rows.reduce((sum, row) => sum + row.cost, 0);
    return true;
  }

  private loadOpeningStockFallback() {
    return this.businessData.getOpeningStock(this.shopId).then((openingStock) => {
      if (!openingStock || openingStock.status === 'draft' || !Array.isArray(openingStock.rows)) return;
      this.stockDate = openingStock.date || '';
      const rows: StockRow[] = [];
      openingStock.rows.forEach((row: any) => {
        const stock = Number(row.bottles || 0);
        const mrp = Number(row.mrp || 0);
        if (stock <= 0) return;
        rows.push({
          serial: rows.length + 1,
          brand: String(row.brand || '').trim(),
          code: String(row.code || '').trim(),
          size: `${row.size || row.sizeMl || ''}ml`,
          mrp,
          stock,
          cost: stock * mrp
        });
      });
      this.stockRows = rows;
      this.totalStockCost = rows.reduce((sum, row) => sum + row.cost, 0);
    }).catch(() => undefined);
  }

  private loadSubmissions(): any[] {
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      return Array.isArray(saved)
        ? saved.filter((item) => String(item.shopId || '').toUpperCase() === String(this.shopId || '').toUpperCase())
        : [];
    } catch {
      return [];
    }
  }

  private readSessionShop(): { id?: string; name?: string } {
    try {
      return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
    } catch {
      return {};
    }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value || 0));
  }

  private truncateText(value: string, maxChars: number): string {
    if (value.length <= maxChars) {
      return value;
    }
    return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
  }
}

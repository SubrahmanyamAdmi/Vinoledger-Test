import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';

type OwnerInvoice = {
  id: string;
  date: string;
  referenceNo: string;
  amount: number;
  shopId: string;
  customer?: string;
  description?: string;
  fileName?: string;
  fileData?: string;
  fileType?: string;
  totalCases?: number;
  rows?: { code: string; brand: string; size: number; cases: number; bottles: number }[];
};

@Component({
  selector: 'app-owner-invoices',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owner-invoices.component.html',
  styleUrls: ['./owner-invoices.component.scss']
})
export class OwnerInvoicesComponent implements OnInit {
  invoices: OwnerInvoice[] = [];
  shopId = '';
  ownerName = '';
  totalAmount = 0;
  private readonly invoiceStorageKey = 'vinoledger.invoices';

  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService) {}

  ngOnInit() {
    const user = this.auth.currentUser();
    const sessionShop = this.readSessionShop();
    this.shopId = user?.shopId || sessionShop.id || 'MH2091';
    this.ownerName = user?.name || sessionShop.owner || 'Shop Owner';
    this.businessData.getInvoices().subscribe({
      next: (invoices) => this.setInvoices(invoices.length ? invoices : this.readLegacyInvoices()),
      error: () => this.setInvoices(this.readLegacyInvoices())
    });
  }

  viewInvoice(invoice: OwnerInvoice) {
    window.alert(`Invoice ${invoice.referenceNo}\nAmount: ${invoice.amount.toFixed(2)}`);
  }

  downloadInvoice(invoice: OwnerInvoice) {
    const content = [
      ['Invoice ID', invoice.id],
      ['Reference Number', invoice.referenceNo],
      ['Date', invoice.date],
      ['Shop ID', invoice.shopId],
      ['Customer', invoice.customer || ''],
      ['Amount', invoice.amount.toFixed(2)],
      ['Total Cases', invoice.totalCases ?? ''],
      ['Description', invoice.description || ''],
      ['Uploaded File', invoice.fileName || invoice.description || '']
    ].map(row => row.map(value => this.csvValue(value)).join(',')).join('\n');
    const lineItems = invoice.rows?.length
      ? `\n\n${['Code', 'Brand', 'Size (ml)', 'Cases', 'Bottles'].map(value => this.csvValue(value)).join(',')}\n${invoice.rows.map(row =>
        [row.code, row.brand, row.size, row.cases, row.bottles].map(value => this.csvValue(value)).join(',')
      ).join('\n')}`
      : '';
    const blob = new Blob([content + lineItems], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${invoice.referenceNo || invoice.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  downloadInvoiceFile(invoice: OwnerInvoice) {
    if (!invoice.fileData) {
      window.alert('The original uploaded file is not available for this older invoice.');
      return;
    }
    const link = document.createElement('a');
    link.href = invoice.fileData;
    link.download = invoice.fileName || invoice.description || `${invoice.referenceNo || invoice.id}.pdf`;
    link.click();
  }

  goBack() {
    this.router.navigate(['/owner']);
  }

  private loadInvoices() {
    this.setInvoices(this.readLegacyInvoices());
  }

  private setInvoices(saved: any[]) {
    this.invoices = Array.isArray(saved)
      ? saved.filter((invoice: OwnerInvoice) => this.normalize(invoice.shopId) === this.normalize(this.shopId))
      : [];
    this.totalAmount = this.invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  }

  private readLegacyInvoices(): OwnerInvoice[] {
    const savedValue = localStorage.getItem(this.invoiceStorageKey);
    const saved = savedValue ? JSON.parse(savedValue) : this.createDefaultInvoices();
    if (!savedValue) localStorage.setItem(this.invoiceStorageKey, JSON.stringify(saved));
    return Array.isArray(saved) ? saved : [];
  }

  private createDefaultInvoices(): OwnerInvoice[] {
    return [
      { id: 'INV-001', date: 'Oct 24, 2023', referenceNo: 'INV-#001', amount: 1240, shopId: 'MH2091', customer: 'Marson House (MH2091)' },
      { id: 'INV-002', date: 'Oct 22, 2023', referenceNo: 'INV-#002', amount: 850.5, shopId: 'MH2091', customer: 'Marson House (MH2091)' },
      { id: 'INV-003', date: 'Oct 15, 2023', referenceNo: 'INV-#003', amount: 2100, shopId: 'MH2091', customer: 'Marson House (MH2091)' },
      { id: 'INV-004', date: 'Oct 10, 2023', referenceNo: 'INV-#004', amount: 430, shopId: 'MH2091', customer: 'Marson House (MH2091)' },
      { id: 'INV-005', date: 'Sep 28, 2023', referenceNo: 'INV-#005', amount: 1120.75, shopId: 'MH2091', customer: 'Marson House (MH2091)' },
      { id: 'INV-006', date: 'Sep 20, 2023', referenceNo: 'INV-#006', amount: 980, shopId: 'MH2091', customer: 'Marson House (MH2091)' },
      { id: 'INV-007', date: 'Sep 12, 2023', referenceNo: 'INV-#007', amount: 150.25, shopId: 'MH2091', customer: 'Marson House (MH2091)' },
      { id: 'INV-008', date: 'Sep 05, 2023', referenceNo: 'INV-#008', amount: 3400, shopId: 'MH2091', customer: 'Marson House (MH2091)' }
    ];
  }

  private readSessionShop(): { id?: string; owner?: string } {
    try {
      return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
    } catch {
      return {};
    }
  }

  private normalize(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private csvValue(value: unknown) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }
}

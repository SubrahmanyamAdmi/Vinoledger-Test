import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService, InvoiceRecord } from '../../services/business-data.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppSelectComponent, AppSelectOption } from '../../shared/select/select.component';

interface InvoiceCustomer {
  id: string;
  name: string;
  shopId: string;
  openingDate: string;
}

@Component({
  selector: 'app-admin-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppSelectComponent],
  templateUrl: './admin-invoices.component.html',
  styleUrls: ['./admin-invoices.component.scss', './admin-page-theme.scss']
})
export class AdminInvoicesComponent implements OnInit {
  customers: InvoiceCustomer[] = [];

  selectedCustomerId = '';
  selectedCustomer: any = null;

  invoices: InvoiceRecord[] = [];
  private allInvoices: InvoiceRecord[] = [];
  totalAmount = 0;
  private readonly invoiceStorageKey = 'vinoledger.invoices';

  get customerOptions(): AppSelectOption[] {
    return this.customers.map((customer) => ({
      value: customer.id,
      label: `${customer.name} - ${customer.shopId}`,
    }));
  }

  constructor(private router: Router, public auth: AuthService, private businessData: BusinessDataService) {}

  ngOnInit() {
    this.loadCustomers();
    this.loadInvoices();
  }

  private loadCustomers() {
    this.businessData.getShops().subscribe({
      next: (shops) => {
        const registeredShops = this.auth.getRegisteredShops();
        const byShopId = new Map<string, InvoiceCustomer>();
        [...registeredShops, ...shops].forEach((shop: any) => {
          const shopId = String(shop.shopId || shop.id || '').trim();
          if (!shopId) return;
          byShopId.set(shopId.toUpperCase(), {
            id: shopId,
            shopId,
            name: String(shop.owner || shop.ownerName || shop.name || shopId),
            openingDate: String(shop.openingDate || shop.createdAt || '').slice(0, 10),
          });
        });
        this.customers = Array.from(byShopId.values());
      },
      error: () => {
        this.customers = this.auth.getRegisteredShops()
          .map((shop: any) => {
            const shopId = String(shop.shopId || shop.id || '').trim();
            return shopId ? {
              id: shopId,
              shopId,
              name: String(shop.owner || shop.ownerName || shop.name || shopId),
              openingDate: String(shop.openingDate || shop.createdAt || '').slice(0, 10),
            } : null;
          })
          .filter((shop): shop is InvoiceCustomer => shop !== null);
      },
    });
  }

  private loadInvoices() {
    this.businessData.getInvoices().subscribe({
      next: (invoices) => {
        this.allInvoices = invoices.length ? invoices : this.readLegacyInvoices();
        this.applySelectedCustomerFilter();
      },
      error: () => {
        this.allInvoices = this.readLegacyInvoices();
        this.applySelectedCustomerFilter();
      },
    });
  }

  private readLegacyInvoices(): InvoiceRecord[] {
    try {
      const saved = JSON.parse(localStorage.getItem(this.invoiceStorageKey) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  selectCustomer() {
    this.selectedCustomer = this.customers.find((customer) => customer.id === this.selectedCustomerId) || null;
    this.applySelectedCustomerFilter();
  }

  private applySelectedCustomerFilter() {
    const selectedShopId = String(this.selectedCustomer?.shopId || '').trim().toUpperCase();
    this.invoices = selectedShopId
      ? this.allInvoices.filter((invoice) => String(invoice.shopId || '').trim().toUpperCase() === selectedShopId)
      : [];
    this.updateTotalAmount();
  }

  viewInvoice(invoiceId: string) {
    alert('Viewing invoice details for ' + invoiceId);
  }

  downloadInvoice(invoiceId: string) {
    alert('Downloading invoice ' + invoiceId);
  }

  updateTotalAmount() {
    this.totalAmount = this.invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}

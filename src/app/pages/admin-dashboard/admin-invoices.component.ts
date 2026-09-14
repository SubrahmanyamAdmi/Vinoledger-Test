import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-invoices.component.html',
  styleUrls: ['./admin-invoices.component.scss']
})
export class AdminInvoicesComponent implements OnInit {
  customers = [
    { id: '1', name: 'Rajesh Kumar', shopId: 'MH2041' },
    { id: '2', name: 'Anita Sharma', shopId: 'PU2042' },
    { id: '3', name: 'Vikram Singh', shopId: 'DL2043' },
    { id: '4', name: 'Suresh Raina', shopId: 'KA2044' },
    { id: '5', name: 'Meera Iyer', shopId: 'TN2045' }
  ];

  selectedCustomerId = '';
  selectedCustomer: any = null;
  showAddForm = false;

  invoices: any[] = [];
  totalAmount = 0;
  private readonly invoiceStorageKey = 'vinoledger.invoices';

  // Add invoice form
  newInvoice = {
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    amount: 0,
    description: ''
  };

  constructor(private router: Router) {}

  ngOnInit() {
    this.initializeSampleInvoices();
  }

  initializeSampleInvoices() {
    const savedInvoices = JSON.parse(localStorage.getItem(this.invoiceStorageKey) || 'null');
    if (Array.isArray(savedInvoices)) {
      this.invoices = savedInvoices;
      this.updateTotalAmount();
      return;
    }

    this.invoices = [
      { 
        id: 'INV-001', 
        date: 'Oct 24, 2023', 
        referenceNo: 'INV-#001', 
        amount: 1240.00,
        customer: 'Marson House (MH2091)',
        shopId: 'MH2091'
      },
      { 
        id: 'INV-002', 
        date: 'Oct 22, 2023', 
        referenceNo: 'INV-#002', 
        amount: 850.50,
        customer: 'Marson House (MH2091)', shopId: 'MH2091'
      },
      { 
        id: 'INV-003', 
        date: 'Oct 15, 2023', 
        referenceNo: 'INV-#003', 
        amount: 2100.00,
        customer: 'Marson House (MH2091)', shopId: 'MH2091'
      },
      { 
        id: 'INV-004', 
        date: 'Oct 10, 2023', 
        referenceNo: 'INV-#004', 
        amount: 430.00,
        customer: 'Marson House (MH2091)', shopId: 'MH2091'
      },
      { 
        id: 'INV-005', 
        date: 'Sep 28, 2023', 
        referenceNo: 'INV-#005', 
        amount: 1120.75,
        customer: 'Marson House (MH2091)', shopId: 'MH2091'
      },
      { 
        id: 'INV-006', 
        date: 'Sep 20, 2023', 
        referenceNo: 'INV-#006', 
        amount: 980.00,
        customer: 'Marson House (MH2091)', shopId: 'MH2091'
      },
      { 
        id: 'INV-007', 
        date: 'Sep 12, 2023', 
        referenceNo: 'INV-#007', 
        amount: 150.25,
        customer: 'Marson House (MH2091)', shopId: 'MH2091'
      },
      { 
        id: 'INV-008', 
        date: 'Sep 05, 2023', 
        referenceNo: 'INV-#008', 
        amount: 3400.00,
        customer: 'Marson House (MH2091)', shopId: 'MH2091'
      }
    ];

    localStorage.setItem(this.invoiceStorageKey, JSON.stringify(this.invoices));
    this.updateTotalAmount();
  }

  selectCustomer() {
    if (this.selectedCustomerId) {
      this.selectedCustomer = this.customers.find(c => c.id === this.selectedCustomerId);
      this.showAddForm = false;
    } else {
      this.selectedCustomer = null;
    }
  }

  viewInvoice(invoiceId: string) {
    alert('Viewing invoice details for ' + invoiceId);
  }

  downloadInvoice(invoiceId: string) {
    alert('Downloading invoice ' + invoiceId);
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (this.showAddForm) {
      this.resetForm();
    }
  }

  addInvoice() {
    if (!this.newInvoice.referenceNo || this.newInvoice.amount <= 0) {
      alert('Please fill all required fields');
      return;
    }

    const invoice = {
      id: 'INV-' + String(this.invoices.length + 1).padStart(3, '0'),
      date: this.newInvoice.date,
      referenceNo: this.newInvoice.referenceNo,
      amount: this.newInvoice.amount,
      customer: this.selectedCustomer.name + ' (' + this.selectedCustomer.shopId + ')',
      shopId: this.selectedCustomer.shopId,
      description: this.newInvoice.description
    };

    this.invoices.unshift(invoice);
    localStorage.setItem(this.invoiceStorageKey, JSON.stringify(this.invoices));
    this.updateTotalAmount();
    this.resetForm();
    this.showAddForm = false;
    alert('Invoice added successfully');
  }

  resetForm() {
    this.newInvoice = {
      date: new Date().toISOString().split('T')[0],
      referenceNo: '',
      amount: 0,
      description: ''
    };
  }

  updateTotalAmount() {
    this.totalAmount = this.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import { environment } from '../../../environments/environment';

interface SheetSize { size: string; opening: number; sales: number; closing: number; price: number; amount: number; balanceEntered?: boolean; }
interface SheetRecord { brand: string; code: string; date: string; sizes: SheetSize[]; difference?: number; remarks?: string; }
interface ExpenseRow { name: string; value: number; comment: string; }
interface ProfitRow { name: string; value: number; comment: string; }
interface CashDetails { cashDeposit: number; phonePay: number; comments: string; bankChallanReceipt: string; }

@Component({ selector: 'app-day-sheet', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './day-sheet.component.html', styleUrls: ['./day-sheet.component.scss'] })
export class DaySheetComponent {
  shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{"id":"KKD41","owner":"Y Bathalaswamy"}');
  date = sessionStorage.getItem('vinoledger.date') || new Date().toISOString().slice(0, 10);
  records: SheetRecord[] = this.loadUniqueRecords();
  sizes = ['1L', 'Q', 'P', 'N', 'D'];
  expenseDialogOpen = false;
  additionalProfitDialogOpen = false;
  cashDetailsDialogOpen = false;
  submitDialogOpen = false;
  submissionSuccessDialogOpen = false;
  isSubmitting = false;
  sheetAmount: number | null = null;
  comparisonMessage = '';
  comparisonSuccessful: boolean | null = null;
  submissionMode: 'firebase' | 'local' = 'firebase';
  additionalProfitRows: ProfitRow[] = this.createProfitRows();
  expenseRows: ExpenseRow[] = this.createExpenseRows();
  cashDetails: CashDetails = this.loadCashDetails();

  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService) {
    this.removeLegacyApplicationShare();
  }

  sizeRecord(record: SheetRecord, size: string) {
    return record.sizes.find(item =>
      item.size.startsWith(
        size === '1L' ? '1000' : size === 'Q' ? '750' : size === 'P' ? '375' : size === 'N' ? '180' : '90'
      )
    );
  }

  getSizeValue(record: SheetRecord, size: string, type: 'opening' | 'sales' | 'closing' | 'price') {
    const item = this.sizeRecord(record, size);
    return item ? item[type] : 0;
  }

  updateBalance(record: SheetRecord, size: string, value: number) {
    const item = this.sizeRecord(record, size);
    if (!item) return;
    const enteredBalance = Math.max(0, Number(value) || 0);
    item.closing = Math.min(item.opening, enteredBalance);
    item.balanceEntered = true;
    item.sales = Math.max(0, item.opening - item.closing);
    item.amount = item.sales * item.price;
    this.persistRecords();
  }

  totalAmount(record: SheetRecord) {
    return record.sizes.reduce((total, item) => total + item.amount, 0);
  }

  totalDaySale() {
    return this.records.reduce((total, record) => total + this.totalAmount(record), 0);
  }

  totalExpenses() {
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.expenseEntries') || '[]');
    if (Array.isArray(saved) && saved.length) {
      return saved.reduce((sum: number, row: ExpenseRow) => {
        const value = Number(row.value);
        return Number.isFinite(value) && value >= 0 ? sum + value : sum;
      }, 0);
    }
    const value = Number(sessionStorage.getItem('vinoledger.totalExpenses') || '0');
    return Number.isFinite(value) ? value : 0;
  }

  grandTotal() {
    return this.totalDaySale() + this.additionalProfitTotal() - this.totalExpenses();
  }

  addEntry() {
    this.router.navigate(['/daily-sales']);
  }

  addExpense() {
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.expenseEntries') || '[]');
    if (Array.isArray(saved)) {
      const savedByName = new Map(saved.map((row: ExpenseRow) => [row.name, row]));
      this.expenseRows = this.createExpenseRows().map((row) => {
        const savedRow = savedByName.get(row.name);
        return savedRow
          ? { ...row, value: Number(savedRow.value || 0), comment: savedRow.comment || '' }
          : row;
      });
    }
    this.expenseDialogOpen = true;
  }

  addAdditionalProfit() {
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.additionalProfitRows') || '[]');
    if (Array.isArray(saved)) {
      const savedByName = new Map(saved.map((row: ProfitRow) => [row.name, row]));
      this.additionalProfitRows = this.createProfitRows().map((row) => {
        const savedRow = savedByName.get(row.name);
        return savedRow ? { ...row, value: Number(savedRow.value || 0), comment: savedRow.comment || '' } : row;
      });
    }
    this.additionalProfitDialogOpen = true;
  }

  addCashDetails() {
    this.cashDetails = this.loadCashDetails();
    this.cashDetailsDialogOpen = true;
  }

  closeAdditionalProfitDialog() {
    this.additionalProfitDialogOpen = false;
  }

  closeCashDetailsDialog() {
    this.cashDetailsDialogOpen = false;
  }

  saveAdditionalProfit() {
    this.additionalProfitRows = this.additionalProfitRows.map((row) => ({ ...row, value: Math.max(0, Number(row.value || 0)) }));
    sessionStorage.setItem('vinoledger.additionalProfitRows', JSON.stringify(this.additionalProfitRows));
    this.additionalProfitDialogOpen = false;
  }

  saveCashDetails() {
    const cleaned = {
      cashDeposit: Math.max(0, Number(this.cashDetails.cashDeposit || 0)),
      phonePay: Math.max(0, Number(this.cashDetails.phonePay || 0)),
      comments: this.cashDetails.comments || '',
      bankChallanReceipt: this.cashDetails.bankChallanReceipt || ''
    };

    this.cashDetails = cleaned;
    sessionStorage.setItem('vinoledger.cashDetails', JSON.stringify(cleaned));
    this.cashDetailsDialogOpen = false;
  }

  onBankChallanSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    this.cashDetails.bankChallanReceipt = file ? file.name : '';
  }

  additionalProfitTotal() {
    return this.additionalProfitRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  }

  submitSheet() {
    this.sheetAmount = null;
    this.comparisonMessage = '';
    this.comparisonSuccessful = null;
    this.submitDialogOpen = true;
  }

  hasSheetAmount() {
    return this.sheetAmount !== null && Number.isFinite(Number(this.sheetAmount)) && Number(this.sheetAmount) >= 0;
  }

  closeSubmitDialog() {
    this.submitDialogOpen = false;
    this.isSubmitting = false;
  }

  async confirmSubmit() {
    if (!this.hasSheetAmount() || this.isSubmitting) {
      return;
    }

    const enteredAmount = Number(this.sheetAmount);
    const expectedAmount = this.grandTotal();
    if (Math.abs(enteredAmount - expectedAmount) > 0.01) {
      this.comparisonSuccessful = false;
      this.comparisonMessage = `Sheet Amount must exactly match Grand Total (₹ ${expectedAmount.toFixed(2)}).`;
      return;
    }

    const cashTotal = Number(this.cashDetails.cashDeposit || 0) + Number(this.cashDetails.phonePay || 0);
    if (!this.cashDetails.bankChallanReceipt) {
      this.comparisonSuccessful = false;
      this.comparisonMessage = 'Cash Details and Bank Challan Receipt are required before submission.';
      return;
    }

    if (Math.abs(cashTotal - expectedAmount) > 0.01) {
      this.comparisonSuccessful = false;
      this.comparisonMessage = `Cash Details must match Grand Total (₹ ${expectedAmount.toFixed(2)}). Current total: ₹ ${cashTotal.toFixed(2)}.`;
      return;
    }

    const submission = {
      shop: this.shop,
      shopId: String(this.shop.id || ''),
      date: this.date,
      cashier: this.auth.currentUser()?.name || 'Cashier',
      records: this.records,
      expenses: JSON.parse(sessionStorage.getItem('vinoledger.expenseEntries') || '[]'),
      additionalProfitRows: this.additionalProfitRows,
      cashDetails: this.cashDetails,
      additionalProfit: this.additionalProfitTotal(),
      totalDaySale: this.totalDaySale(),
      totalExpenses: this.totalExpenses(),
      grandTotal: this.grandTotal(),
      submittedAmount: enteredAmount,
      submittedAt: new Date().toISOString()
    };
    this.isSubmitting = true;
    try {
      if (this.isFirebaseConfigured()) {
        await this.businessData.saveDaySheet(submission);
        this.submissionMode = 'firebase';
      } else {
        this.submissionMode = 'local';
      }
      sessionStorage.setItem('vinoledger.daySheetSubmission', JSON.stringify(submission));
      localStorage.setItem('vinoledger.daySheetSubmission', JSON.stringify(submission));
      this.saveSubmissionHistory(submission);
      this.markDateSubmitted(this.date);
      this.clearSubmittedEntryForms();
    } catch (error) {
      this.comparisonSuccessful = false;
      this.comparisonMessage = error instanceof Error
        ? `Unable to submit to Firebase: ${error.message}`
        : 'Unable to submit to Firebase. Check your Firebase login and configuration.';
      return;
    } finally {
      this.isSubmitting = false;
    }
    this.comparisonSuccessful = true;
    this.comparisonMessage = '';
    this.submitDialogOpen = false;
    this.submissionSuccessDialogOpen = true;
  }

  private isFirebaseConfigured() {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.appId && config.projectId &&
      config.apiKey !== 'YOUR_API_KEY' && config.projectId !== 'YOUR_PROJECT_ID');
  }

  private markDateSubmitted(date: string) {
    const key = String(this.shop.id || 'KKD41');
    let submitted: Record<string, string[]> = {};
    try {
      submitted = JSON.parse(localStorage.getItem('vinoledger.submittedDates') || '{}');
    } catch {
      submitted = {};
    }
    const dates = Array.isArray(submitted[key]) ? submitted[key] : [];
    if (!dates.includes(date)) {
      submitted[key] = [...dates, date];
      localStorage.setItem('vinoledger.submittedDates', JSON.stringify(submitted));
    }
  }

  private saveSubmissionHistory(submission: Record<string, unknown>) {
    let history: Record<string, unknown>[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      history = Array.isArray(saved) ? saved : [];
    } catch {
      history = [];
    }

    const shopId = String(submission['shopId'] || this.shop.id || 'KKD41');
    const date = String(submission['date'] || this.date);
    const withoutDuplicate = history.filter((item) =>
      String(item['shopId'] || item['shop'] && (item['shop'] as { id?: string }).id) !== shopId ||
      String(item['date'] || '') !== date
    );
    localStorage.setItem('vinoledger.daySheetSubmissions', JSON.stringify([...withoutDuplicate, submission]));
  }

  closeSubmissionSuccessDialog() {
    this.submissionSuccessDialogOpen = false;
    this.router.navigateByUrl('/sheet-date');
  }

  cancelSheet() {
    this.router.navigate(['/sheet-date']);
  }

  private createExpenseRows(): ExpenseRow[] {
    return [
      { name: 'Rent', value: 0, comment: '' },
      { name: 'Current Bill', value: 0, comment: '' },
      { name: 'Salaries', value: 0, comment: '' },
      { name: 'Department Formality', value: 0, comment: '' },
      { name: 'Stock Transport', value: 0, comment: '' },
      { name: 'Other', value: 0, comment: '' },
    ];
  }

  private createProfitRows(): ProfitRow[] {
    return [
      { name: 'Empty Bottles', value: 0, comment: '' },
      { name: 'Brand Discounts', value: 0, comment: '' },
      { name: 'Other Benefits', value: 0, comment: '' },
    ];
  }

  private loadCashDetails(): CashDetails {
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.cashDetails') || '{}');
    return {
      cashDeposit: Number(saved.cashDeposit || 0),
      phonePay: Number(saved.phonePay || 0),
      comments: saved.comments || '',
      bankChallanReceipt: saved.bankChallanReceipt || ''
    };
  }

  private removeLegacyApplicationShare() {
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.expenseEntries') || '[]');
    if (Array.isArray(saved)) {
      const filtered = saved.filter((row: ExpenseRow) => row.name !== 'Application Share');
      sessionStorage.setItem('vinoledger.expenseEntries', JSON.stringify(filtered));
      sessionStorage.setItem('vinoledger.totalExpenses', String(filtered.reduce((sum, row) => sum + Number(row.value || 0), 0)));
    }
  }

  private loadUniqueRecords(): SheetRecord[] {
    const currentKey = this.daySheetKey();
    const legacyKey = `vinoledger.daySheet.${this.normalize(String(this.shop.id || 'KKD41'))}`;
    const raw = sessionStorage.getItem(currentKey) ?? sessionStorage.getItem(legacyKey) ?? '[]';
    let saved = JSON.parse(raw);
    if (!Array.isArray(saved)) {
      return [];
    }

    const seenNames = new Set<string>();
    const seenCodes = new Set<string>();
    const uniqueRecords = saved.filter((record: SheetRecord) => {
      const name = this.normalize(record.brand);
      const code = this.normalize(record.code);
      const isSearchBrand = !code || code === 'searched';
      if (seenNames.has(name) || (!isSearchBrand && seenCodes.has(code))) {
        return false;
      }
      seenNames.add(name);
      if (!isSearchBrand) {
        seenCodes.add(code);
      }
      return true;
    });

    const records = this.applyStockFlow(uniqueRecords);
    sessionStorage.setItem(currentKey, JSON.stringify(records));
    return records;
  }

  private persistRecords() {
    sessionStorage.setItem(this.daySheetKey(), JSON.stringify(this.records));
  }

  private daySheetKey() {
    return `vinoledger.daySheet.${this.normalize(String(this.shop.id || 'KKD41'))}.${this.normalize(String(this.date || new Date().toISOString().slice(0, 10)) )}`;
  }

  private applyStockFlow(saved: any[]): SheetRecord[] {
    const invoices = this.readInvoices();
    const previous = this.readPreviousClosing();
    const byProduct = new Map<string, SheetRecord>();

    invoices.forEach((invoice: any) => {
      (invoice.rows || []).forEach((row: any) => {
        const key = `${this.normalize(row.code || '')}|${this.normalize(row.brand || '')}`;
        const record: SheetRecord = byProduct.get(key) || { brand: row.brand || '', code: row.code || '', date: this.date, sizes: [] };
        const sizeName = `${Number(row.size || 0)}ml`;
        const item = record.sizes.find(size => size.size === sizeName);
        const bottles = Number(row.bottles || 0);
        if (item) item.opening += bottles;
        else record.sizes.push({ size: sizeName, opening: bottles, sales: bottles, closing: 0, price: this.lookupMrp(record.brand, sizeName), amount: bottles * this.lookupMrp(record.brand, sizeName), balanceEntered: false });
        byProduct.set(key, record);
      });
    });

    saved.forEach((raw: any) => {
      const key = `${this.normalize(raw.code || '')}|${this.normalize(raw.brand || '')}`;
      const record: SheetRecord = byProduct.get(key) || { brand: raw.brand || '', code: raw.code || '', date: this.date, sizes: [] };
      (raw.sizes || []).forEach((rawSize: any) => {
        const item = record.sizes.find(size => size.size === rawSize.size);
        const hasBalance = rawSize.balanceEntered === true;
        const sales = hasBalance ? Math.max(0, Number(rawSize.opening || 0) - Number(rawSize.closing || 0)) : Number(rawSize.sales ?? rawSize.closing ?? 0);
        if (item) {
          item.sales = sales;
          item.closing = hasBalance ? Number(rawSize.closing || 0) : Math.max(0, item.opening - sales);
          item.balanceEntered = hasBalance;
          item.price = Number(rawSize.price || item.price || this.lookupMrp(record.brand, rawSize.size));
        } else {
          record.sizes.push({
            size: rawSize.size,
            opening: Number(rawSize.opening || 0),
            sales,
            closing: hasBalance ? Number(rawSize.closing || 0) : Math.max(0, Number(rawSize.opening || 0) - sales),
            price: Number(rawSize.price || this.lookupMrp(record.brand, rawSize.size)),
            amount: sales * Number(rawSize.price || this.lookupMrp(record.brand, rawSize.size)),
            balanceEntered: hasBalance
          });
        }
      });
      byProduct.set(key, record);
    });

    return Array.from(byProduct.values()).map(record => {
        record.sizes = record.sizes.map(item => {
        const previousClosing = previous.get(`${this.normalize(record.code)}|${this.normalize(record.brand)}|${item.size}`);
        if (previousClosing !== undefined) item.opening = previousClosing;
          if (item.balanceEntered) {
            item.closing = Math.min(item.opening, Math.max(0, item.closing));
            item.sales = Math.max(0, item.opening - item.closing);
          } else {
            item.closing = 0;
            item.sales = item.opening;
          }
        item.amount = item.sales * item.price;
        return item;
      });
      return record;
    });
  }

  private readInvoices(): any[] {
    try {
      const invoices = JSON.parse(localStorage.getItem('vinoledger.invoices') || '[]');
      return (Array.isArray(invoices) ? invoices : []).filter((invoice: any) =>
        this.normalize(String(invoice.shopId || '')) === this.normalize(String(this.shop.id || '')) &&
        String(invoice.date || '') <= this.date
      );
    } catch {
      return [];
    }
  }

  private lookupMrp(brandName: string, sizeName: string) {
    try {
      const brands = JSON.parse(localStorage.getItem('vinoledger.mrp.brands') || '[]');
      const brand = (Array.isArray(brands) ? brands : []).find((item: any) => this.normalize(item.brand) === this.normalize(brandName));
      const size = brand?.sizes?.find((item: any) => item.size === sizeName);
      return Number(size?.mrp || 0);
    } catch {
      return 0;
    }
  }

  private readPreviousClosing() {
    const closing = new Map<string, number>();
    try {
      const history = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      const prior = (Array.isArray(history) ? history : [])
        .filter((submission: any) => this.normalize(String(submission.shopId || '')) === this.normalize(String(this.shop.id || '')) && String(submission.date || '') < this.date)
        .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))[0];
      (prior?.records || []).forEach((record: any) => (record.sizes || []).forEach((size: any) => {
        closing.set(`${this.normalize(record.code)}|${this.normalize(record.brand)}|${size.size}`, Number(size.closing || 0));
      }));
    } catch {
      return closing;
    }
    return closing;
  }

  private normalize(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private clearSubmittedEntryForms() {
    this.expenseRows = this.createExpenseRows();
    this.additionalProfitRows = this.createProfitRows();
    this.cashDetails = { cashDeposit: 0, phonePay: 0, comments: '', bankChallanReceipt: '' };
    sessionStorage.removeItem('vinoledger.expenseEntries');
    sessionStorage.removeItem('vinoledger.totalExpenses');
    sessionStorage.removeItem('vinoledger.additionalProfitRows');
    sessionStorage.removeItem('vinoledger.cashDetails');
  }

  closeExpenseDialog() {
    this.expenseRows = this.createExpenseRows();
    this.expenseDialogOpen = false;
  }

  saveExpenseEntries() {
    const validEntries = this.expenseRows
      .map((row) => ({
        name: row.name,
        value: Number(row.value || 0),
        comment: row.comment || ''
      }))
      .filter((row) => Number(row.value) >= 0);

    sessionStorage.setItem('vinoledger.expenseEntries', JSON.stringify(validEntries));
    sessionStorage.setItem('vinoledger.totalExpenses', String(validEntries.reduce((sum, row) => sum + row.value, 0)));

    this.expenseDialogOpen = false;
    this.expenseRows = this.createExpenseRows();
  }
}


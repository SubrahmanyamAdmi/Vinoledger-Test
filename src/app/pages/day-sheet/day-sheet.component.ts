import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService, InvoiceRecord, DaySheetRecord } from '../../services/business-data.service';
import { FirestoreService } from '../../services/firestore.service';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/icon/icon.component';

interface SheetSize { size: string; opening: number; sales: number; closing: number; price: number; amount: number; balanceEntered?: boolean; }
interface SheetRecord { brand: string; code: string; productType?: string; date: string; sizes: SheetSize[]; difference?: number; remarks?: string; }
interface ExpenseRow { name: string; value: number; comment: string; }
interface ProfitRow { name: string; value: number; comment: string; }
interface CashDetails { cashDeposit: number; phonePay: number; comments: string; bankChallanReceipt: string; }

@Component({ selector: 'app-day-sheet', standalone: true, imports: [CommonModule, FormsModule, IconComponent], templateUrl: './day-sheet.component.html', styleUrls: ['./day-sheet.component.scss', '../admin-dashboard/admin-page-theme.scss'] })
export class DaySheetComponent implements OnInit {
  shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{"id":"KKD41","owner":"Y Bathalaswamy"}');
  date = sessionStorage.getItem('vinoledger.date') || new Date().toISOString().slice(0, 10);
  records: SheetRecord[] = this.loadUniqueRecords([], []);
  isLoadingRecords = true;
  expenseDialogOpen = false;
  additionalProfitDialogOpen = false;
  cashDetailsDialogOpen = false;
  submitDialogOpen = false;
  missingMrpDialogOpen = false;
  submissionSuccessDialogOpen = false;
  isSubmitting = false;
  sheetAmount: number | null = null;
  comparisonMessage = '';
  comparisonSuccessful: boolean | null = null;
  submissionMode: 'firebase' | 'local' = 'firebase';
  additionalProfitRows: ProfitRow[] = this.createProfitRows();
  expenseRows: ExpenseRow[] = this.createExpenseRows();
  cashDetails: CashDetails = this.loadCashDetails();

  get isStandaloneTab(): boolean {
    return this.route.snapshot.queryParamMap.get('view') === 'standalone';
  }

  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService, private firestore: FirestoreService, private route: ActivatedRoute) {
    this.removeLegacyApplicationShare();
  }

  async ngOnInit() {
    const query = this.route.snapshot.queryParamMap;
    this.date = query.get('date') || this.date;
    this.shop = {
      ...this.shop,
      id: query.get('shopId') || this.shop.id,
      name: query.get('shopName') || this.shop.name,
      owner: query.get('owner') || this.shop.owner,
    };
    this.loadDraftFromStorage();
    await Promise.all([
      this.syncMrpCatalogFromFirebase(),
      this.syncOpeningStockFromFirebase(),
    ]);
    this.refreshRecordsFromServer();
  }

  closeStandaloneTab() {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    this.router.navigateByUrl('/sheet-date');
  }

  saveDraft() {
    const payload = {
      shopId: String(this.shop.id || ''),
      date: this.date,
      records: this.records,
      expenses: JSON.parse(sessionStorage.getItem('vinoledger.expenseEntries') || '[]'),
      additionalProfit: this.additionalProfitTotal(),
      totalDaySale: this.totalDaySale(),
      totalExpenses: this.totalExpenses(),
      grandTotal: this.grandTotal(),
      submittedAmount: this.sheetAmount ?? 0,
      cashier: this.auth.currentUser()?.name || 'Cashier',
      submittedByName: this.auth.currentUser()?.name || 'Cashier',
      submittedByRole: this.auth.currentUser()?.role || 'User',
      submittedAt: new Date().toISOString(),
      draft: true,
      status: 'draft' as const,
      cashDetails: this.cashDetails,
      additionalProfitRows: this.additionalProfitRows,
    };

    sessionStorage.setItem('vinoledger.daySheetDraft', JSON.stringify(payload));
    localStorage.setItem(`vinoledger.daySheetDraft.${this.shop.id || 'KKD41'}.${this.date}`, JSON.stringify(payload));

    if (this.isFirebaseConfigured()) {
      this.businessData.saveDaySheetDraft(payload).catch(() => undefined);
    }
  }

  private loadDraftFromStorage() {
    const key = `vinoledger.daySheetDraft.${this.shop.id || 'KKD41'}.${this.date}`;
    const raw = localStorage.getItem(key) || sessionStorage.getItem('vinoledger.daySheetDraft');
    if (!raw) return;

    try {
      const draft = JSON.parse(raw);
      if (!draft || !draft.records) return;

      this.records = Array.isArray(draft.records) ? draft.records : this.records;
      this.expenseRows = Array.isArray(draft.expenses) ? draft.expenses : this.expenseRows;
      this.additionalProfitRows = Array.isArray(draft.additionalProfitRows) ? draft.additionalProfitRows : this.additionalProfitRows;
      this.cashDetails = draft.cashDetails || this.cashDetails;
      this.sheetAmount = Number(draft.submittedAmount || 0) || null;
    } catch {
      // ignore malformed draft state
    }
  }

  private async syncMrpCatalogFromFirebase() {
    const activeShopId = String(this.shop?.id || this.auth.currentUser()?.shopId || '').trim();
    if (!activeShopId) {
      return;
    }

    try {
      const globalDoc = await this.firestore.getDocumentOnce<{ brands?: any[] }>('mrpCatalog', 'global');
      const overrideDoc = await this.firestore.getDocumentOnce<{ brands?: any[] }>('mrpCatalogOverrides', activeShopId);
      const globalBrands = Array.isArray(globalDoc?.brands) ? globalDoc.brands : [];
      const overrideBrands = Array.isArray(overrideDoc?.brands) ? overrideDoc.brands : [];
      const mergedBrands = this.mergeMrpCatalogs([globalBrands, overrideBrands]);

      if (!mergedBrands.length) {
        return;
      }

      const storageKey = `vinoledger.mrp.brands.${activeShopId}`;
      localStorage.setItem(storageKey, JSON.stringify(mergedBrands));
    } catch {
      // Ignore sync failures and keep the local catalog.
    }
  }

  private refreshRecordsFromServer() {
    this.isLoadingRecords = true;
    combineLatest([
      this.businessData.getInvoices().pipe(catchError(() => of([] as InvoiceRecord[]))),
      this.businessData.getDaySheets().pipe(catchError(() => of([] as DaySheetRecord[])))
    ]).subscribe(([invoices, daySheets]) => {
      this.records = this.loadUniqueRecords(invoices, daySheets);
      this.isLoadingRecords = false;
    });
  }

  updateBalanceForSize(record: SheetRecord, item: SheetSize, value: number | string | null) {
    if (value === null || value === '' || Number.isNaN(Number(value))) {
      item.balanceEntered = false;
      item.closing = 0;
      item.sales = Math.max(0, Number(item.opening || 0));
      item.amount = item.sales * Number(item.price || 0);
      this.persistRecords();
      return;
    }

    const enteredBalance = Math.max(0, Number(value));
    item.closing = Math.min(Number(item.opening || 0), enteredBalance);
    item.balanceEntered = true;
    item.sales = Math.max(0, Number(item.opening || 0) - item.closing);
    item.amount = item.sales * Number(item.price || 0);
    this.persistRecords();
  }

  onBalanceInput(record: SheetRecord, item: SheetSize, event: Event) {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value;
    if (rawValue === '') {
      this.updateBalanceForSize(record, item, null);
      return;
    }

    const openingStock = Math.max(0, Number(item.opening || 0));
    const enteredValue = Number(rawValue);
    const balanceStock = Math.min(openingStock, Math.max(0, Number.isFinite(enteredValue) ? enteredValue : 0));
    input.value = String(balanceStock);
    this.updateBalanceForSize(record, item, balanceStock);
  }

  hasStock(record: SheetRecord) {
    return record.sizes.some(item => (item.opening || 0) > 0 || (item.closing || 0) > 0);
  }

  get visibleRecords() {
    return this.records.filter(record => this.hasStock(record));
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
    if (this.missingMrpItems.length) {
      this.missingMrpDialogOpen = true;
      return;
    }
    this.sheetAmount = null;
    this.comparisonMessage = '';
    this.comparisonSuccessful = null;
    this.submitDialogOpen = true;
  }

  get missingMrpItems() {
    return this.records.flatMap((record) => record.sizes
      .filter((item) => item.sales > 0 && item.price <= 0)
      .map((item) => `${record.brand} - ${item.size}`));
  }

  closeMissingMrpDialog() {
    this.missingMrpDialogOpen = false;
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
    if (Math.abs(cashTotal - expectedAmount) > 0.01) {
      this.comparisonSuccessful = false;
      this.comparisonMessage = `Cash Details must match Grand Total (₹ ${expectedAmount.toFixed(2)}). Current total: ₹ ${cashTotal.toFixed(2)}.`;
      return;
    }

    const currentUser = this.auth.currentUser();
    const submittedByRole = currentUser?.role === 'Admin' ? 'Admin' : currentUser?.role === 'Owner' ? 'Owner' : 'Cashier';
    const presentCashValue = await this.calculatePresentCashValue();
    const submission = {
      shop: this.shop,
      shopId: String(this.shop.id || ''),
      date: this.date,
      cashier: currentUser?.name || 'Cashier',
      submittedByName: currentUser?.name || 'Cashier',
      submittedByRole,
      submittedByContact: currentUser?.contactNumber || '',
      submittedByEmail: currentUser?.email || '',
      ownerName: this.shop.owner || '',
      records: this.records,
      expenses: JSON.parse(sessionStorage.getItem('vinoledger.expenseEntries') || '[]'),
      additionalProfitRows: this.additionalProfitRows,
      cashDetails: this.cashDetails,
      additionalProfit: this.additionalProfitTotal(),
      totalDaySale: this.totalDaySale(),
      totalExpenses: this.totalExpenses(),
      grandTotal: this.grandTotal(),
      submittedAmount: enteredAmount,
      presentCashValue,
      submittedAt: new Date().toISOString(),
      draft: false,
      status: 'submitted' as const
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

  private async calculatePresentCashValue(): Promise<number> {
    try {
      const [daySheets, invoices] = await Promise.all([
        firstValueFrom(this.businessData.getDaySheets()),
        firstValueFrom(this.businessData.getInvoices())
      ]);
      const shopId = String(this.shop.id || '').toUpperCase();
      const previousSheets = (daySheets || [])
        .filter((sheet: any) => String(sheet.shopId || sheet.shop?.id || '').toUpperCase() === shopId)
        .filter((sheet: any) => String(sheet.date || '') < this.date)
        .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
      const previousBalance = previousSheets.length && Number.isFinite(Number(previousSheets[0].presentCashValue))
        ? Number(previousSheets[0].presentCashValue)
        : previousSheets.reduce((sum: number, sheet: any) => sum + Number(sheet.grandTotal || 0), 0);
      const invoiceTotal = (invoices || [])
        .filter((invoice: any) => String(invoice.shopId || invoice.shop?.id || '').toUpperCase() === shopId)
        .filter((invoice: any) => String(invoice.date || '').slice(0, 10) === this.date)
        .reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
      return previousBalance + this.grandTotal() - invoiceTotal;
    } catch {
      return this.grandTotal();
    }
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

  private loadUniqueRecords(remoteInvoices: InvoiceRecord[], remoteDaySheets: DaySheetRecord[]): SheetRecord[] {
    const currentKey = this.daySheetKey();
    const legacyKey = `vinoledger.daySheet.${this.normalize(String(this.shop.id || 'KKD41'))}`;
    const raw = sessionStorage.getItem(currentKey) ?? sessionStorage.getItem(legacyKey) ?? '[]';
    let saved = JSON.parse(raw);
    if (!Array.isArray(saved)) {
      saved = [];
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

    const records = this.applyStockFlow(uniqueRecords, remoteInvoices, remoteDaySheets);
    sessionStorage.setItem(currentKey, JSON.stringify(records));
    return records;
  }

  private persistRecords() {
    sessionStorage.setItem(this.daySheetKey(), JSON.stringify(this.records));
  }

  private daySheetKey() {
    return `vinoledger.daySheet.${this.normalize(String(this.shop.id || 'KKD41'))}.${this.normalize(String(this.date || new Date().toISOString().slice(0, 10)) )}`;
  }

  private applyStockFlow(saved: any[], remoteInvoices: InvoiceRecord[], remoteDaySheets: DaySheetRecord[]): SheetRecord[] {
    const invoices = this.readInvoices(remoteInvoices);
    const previous = this.readPreviousClosing(remoteDaySheets);
    const byProduct = new Map<string, SheetRecord>();

    const previousSubmission = this.readPreviousDayRecords(remoteDaySheets);
    (previousSubmission?.records || []).forEach((raw: any) => {
      const key = `${this.normalize(raw.code || '')}|${this.normalize(raw.brand || '')}`;
      const record: SheetRecord = byProduct.get(key) || {
        brand: raw.brand || '',
        code: raw.code || '',
        productType: raw.productType || '',
        date: this.date,
        sizes: []
      };
      (raw.sizes || []).forEach((rawSize: any) => {
        const closing = Math.max(0, Number(rawSize.closing || 0));
        const sizeName = String(rawSize.size || '');
        if (!record.sizes.some((size) => size.size === sizeName)) {
          const price = this.lookupMrp(record.code, record.brand, sizeName) || Number(rawSize.price || 0);
          record.sizes.push({
            size: sizeName,
            opening: closing,
            sales: closing,
            closing: 0,
            price,
            amount: closing * price,
            balanceEntered: false
          });
        }
      });
      byProduct.set(key, record);
    });

    if (!previous.size) {
      this.readOpeningStock().forEach((row: any) => {
        const key = `${this.normalize(row.code || '')}|${this.normalize(row.brand || '')}`;
        const record: SheetRecord = byProduct.get(key) || { brand: row.brand || '', code: row.code || '', productType: row.productType || '', date: this.date, sizes: [] };
        record.productType = record.productType || row.productType || '';
        const sizeName = `${Number(row.size || 0)}ml`;
        const bottles = Number(row.bottles || 0);
        const price = Number(row.mrp || 0) || this.lookupMrp(record.code, record.brand, sizeName);
        record.sizes.push({ size: sizeName, opening: bottles, sales: bottles, closing: 0, price, amount: bottles * price, balanceEntered: false });
        byProduct.set(key, record);
      });
    }

    invoices.forEach((invoice: any) => {
      (invoice.rows || []).forEach((row: any) => {
        const key = `${this.normalize(row.code || '')}|${this.normalize(row.brand || '')}`;
        const record: SheetRecord = byProduct.get(key) || { brand: row.brand || '', code: row.code || '', productType: row.productType || '', date: this.date, sizes: [] };
        record.productType = record.productType || row.productType || '';
        const sizeName = `${Number(row.size || 0)}ml`;
        const item = record.sizes.find(size => size.size === sizeName);
        const bottles = Number(row.bottles || 0);
        if (item) item.opening += bottles;
        else record.sizes.push({ size: sizeName, opening: bottles, sales: bottles, closing: 0, price: this.lookupMrp(record.code, record.brand, sizeName), amount: bottles * this.lookupMrp(record.code, record.brand, sizeName), balanceEntered: false });
        byProduct.set(key, record);
      });
    });


    saved.forEach((raw: any) => {
      const key = `${this.normalize(raw.code || '')}|${this.normalize(raw.brand || '')}`;
      const record: SheetRecord = byProduct.get(key) || { brand: raw.brand || '', code: raw.code || '', productType: raw.productType || '', date: this.date, sizes: [] };
      (raw.sizes || []).forEach((rawSize: any) => {
        const item = record.sizes.find(size => size.size === rawSize.size);
        const hasBalance = rawSize.balanceEntered === true;
        const sales = hasBalance ? Math.max(0, Number(rawSize.opening || 0) - Number(rawSize.closing || 0)) : Number(rawSize.sales ?? rawSize.closing ?? 0);
        if (item) {
          item.sales = sales;
          item.closing = hasBalance ? Number(rawSize.closing || 0) : Math.max(0, item.opening - sales);
          item.balanceEntered = hasBalance;
          const catalogPrice = this.lookupMrp(record.code, record.brand, rawSize.size);
          item.price = catalogPrice > 0 ? catalogPrice : Number(rawSize.price || item.price || 0);
        } else {
          const catalogPrice = this.lookupMrp(record.code, record.brand, rawSize.size);
          const price = catalogPrice > 0 ? catalogPrice : Number(rawSize.price || 0);
          record.sizes.push({
            size: rawSize.size,
            opening: Number(rawSize.opening || 0),
            sales,
            closing: hasBalance ? Number(rawSize.closing || 0) : Math.max(0, Number(rawSize.opening || 0) - sales),
            price,
            amount: sales * price,
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
      }).sort((a, b) => this.sizeMl(b.size) - this.sizeMl(a.size));
      return record;
    });
  }

  private sizeMl(size: string) {
    return Number(String(size).replace(/[^0-9.]/g, '')) || 0;
  }

  private readInvoices(remoteInvoices: InvoiceRecord[]): any[] {
    let localInvoices: any[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem('vinoledger.invoices') || '[]');
      localInvoices = Array.isArray(parsed) ? parsed : [];
    } catch {
      localInvoices = [];
    }

    const byId = new Map<string, any>();
    [...localInvoices, ...remoteInvoices].forEach((invoice: any) => {
      const key = String(invoice?.id || invoice?.invoiceNumber || `${invoice?.shopId}-${invoice?.date}-${invoice?.referenceNo || ''}`);
      byId.set(key, invoice);
    });

    return [...byId.values()].filter((invoice: any) =>
      this.normalize(String(invoice.shopId || '')) === this.normalize(String(this.shop.id || '')) &&
      String(invoice.date || '') <= this.date
    );
  }

  private readOpeningStock(): any[] {
    try {
      const shopId = String(this.shop.id || '').toUpperCase();
      const raw = localStorage.getItem(`vinoledger.openingStock.${shopId}`);
      if (!raw) return [];
      const record = JSON.parse(raw);
      if (record?.status === 'draft') return [];
      return Array.isArray(record?.rows) ? record.rows : [];
    } catch {
      return [];
    }
  }

  private async syncOpeningStockFromFirebase() {
    const shopId = String(this.shop?.id || this.auth.currentUser()?.shopId || '').trim();
    if (!shopId) return;

    try {
      const record = await this.businessData.getOpeningStock(shopId);
      const storageKey = `vinoledger.openingStock.${shopId.toUpperCase()}`;
      if (!record || record.status === 'draft') {
        localStorage.removeItem(storageKey);
        return;
      }
      localStorage.setItem(storageKey, JSON.stringify(record));
    } catch {
      // Keep any existing browser cache if Firestore cannot be reached.
    }
  }

  private lookupMrp(brandCode: string, brandName: string, sizeName: string) {
    try {
      const brands = this.getMrpCatalog();
      const normalizedCode = this.normalize(brandCode);
      const normalizedBrand = this.normalize(brandName);
      const requestedSize = this.sizeMl(sizeName);
      const requestedSizeKey = this.normalize(String(sizeName));

      const brand = (Array.isArray(brands) ? brands : []).find((item: any) => {
        const codes = [String(item?.code || ''), ...(item?.codes || []).map((code: unknown) => String(code || ''))].filter(Boolean);
        const itemBrand = this.normalize(String(item?.brand || ''));
        return (normalizedCode && codes.some((code) => this.normalize(code) === normalizedCode))
          || itemBrand === normalizedBrand
          || itemBrand.includes(normalizedBrand)
          || normalizedBrand.includes(itemBrand);
      });

      if (!brand) {
        return 0;
      }

      const size = (brand?.sizes || []).find((item: any) => {
        const itemMl = this.sizeMl(String(item?.sizeMl ?? item?.size ?? ''));
        const itemSizeText = this.normalize(String(item?.size ?? item?.sizeMl ?? ''));
        const itemSizeCode = this.normalize(String(item?.sizeCode ?? ''));
        return itemMl === requestedSize
          || itemSizeText === requestedSizeKey
          || itemSizeCode === requestedSizeKey;
      });

      if (!size) {
        return 0;
      }

      return Number(size?.mrp ?? 0);
    } catch {
      return 0;
    }
  }

  private getMrpCatalog() {
    const activeShopId = String(this.shop?.id || this.auth.currentUser()?.shopId || '').trim();
    const shopKeys = activeShopId ? [
      `vinoledger.mrp.brands.${activeShopId}`,
      `vinoledger.mrp.brands.${activeShopId.toUpperCase()}`,
      `vinoledger.mrp.brands.${activeShopId.toLowerCase()}`
    ] : [];

    const globalKeys = ['vinoledger.mrp.brands.global', 'vinoledger.mrp.brands'];
    const overrideKey = activeShopId ? `vinoledger.mrp.overrides.${activeShopId}` : '';

    const mergedCatalogs: any[] = [];
    const orderedKeys = [...globalKeys, ...shopKeys, ...(overrideKey ? [overrideKey] : [])];

    for (const key of orderedKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          mergedCatalogs.push(parsed);
        }
      } catch {
        // Ignore malformed catalog entries and continue.
      }
    }

    const merged = this.mergeMrpCatalogs(mergedCatalogs);
    return merged;
  }

  private mergeMrpCatalogs(catalogs: any[][]): any[] {
    const byKey = new Map<string, any>();

    catalogs.forEach((catalog) => {
      catalog.forEach((brand: any) => {
        const catalogKey = this.normalize(String(brand?.code || brand?.brand || '')) || this.normalize(String(brand?.brand || ''));
        const existing = byKey.get(catalogKey) || {
          brand: String(brand?.brand || '').trim(),
          code: String(brand?.code || '').trim(),
          codes: [],
          category: brand?.category || '',
          sizes: []
        };

        existing.brand = existing.brand || String(brand?.brand || '').trim();
        existing.code = existing.code || String(brand?.code || '').trim();
        existing.category = existing.category || brand?.category || '';
        existing.codes = Array.from(new Set([...(existing.codes || []), ...(brand?.codes || []), existing.code, String(brand?.code || '').trim()].filter(Boolean)));

        (brand?.sizes || []).forEach((size: any) => {
          const nextSize = {
            size: String(size?.size || size?.sizeMl || '').trim(),
            sizeCode: size?.sizeCode ? String(size.sizeCode).trim() : '',
            sizeMl: Number(size?.sizeMl ?? 0),
            mrp: Number(size?.mrp ?? 0)
          };
          const hasNumericSize = Number.isFinite(nextSize.sizeMl) && nextSize.sizeMl > 0;
          const index = existing.sizes.findIndex((item: any) => {
            const existingSizeMl = Number(item?.sizeMl ?? 0);
            const existingHasNumericSize = Number.isFinite(existingSizeMl) && existingSizeMl > 0;
            if (hasNumericSize || existingHasNumericSize) {
              return hasNumericSize && existingHasNumericSize && existingSizeMl === nextSize.sizeMl;
            }
            return this.normalize(String(item?.sizeCode || item?.size || '')) === this.normalize(String(nextSize.sizeCode || nextSize.size));
          });

          if (index >= 0) {
            existing.sizes[index] = { ...existing.sizes[index], ...nextSize };
          } else {
            existing.sizes.push(nextSize);
          }
        });

        byKey.set(catalogKey, existing);
      });
    });

    return Array.from(byKey.values()).filter((brand: any) => brand.brand && brand.code && Array.isArray(brand.sizes) && brand.sizes.length);
  }

  private readPreviousClosing(remoteDaySheets: DaySheetRecord[]) {
    const closing = new Map<string, number>();
    const prior = this.readPreviousDayRecords(remoteDaySheets);
    (prior?.records || []).forEach((record: any) => (record.sizes || []).forEach((size: any) => {
      closing.set(`${this.normalize(record.code)}|${this.normalize(record.brand)}|${size.size}`, Number(size.closing || 0));
    }));
    return closing;
  }

  private readPreviousDayRecords(remoteDaySheets: DaySheetRecord[]) {
    let localHistory: any[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem('vinoledger.daySheetSubmissions') || '[]');
      localHistory = Array.isArray(parsed) ? parsed : [];
    } catch {
      localHistory = [];
    }

    const byId = new Map<string, any>();
    [...localHistory, ...remoteDaySheets].forEach((submission: any) => {
      const key = String(submission?.id || `${submission?.shopId}-${submission?.date}`);
      byId.set(key, submission);
    });

    return [...byId.values()]
      .filter((submission: any) => this.normalize(String(submission.shopId || '')) === this.normalize(String(this.shop.id || '')) && String(submission.date || '') < this.date)
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))[0];
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


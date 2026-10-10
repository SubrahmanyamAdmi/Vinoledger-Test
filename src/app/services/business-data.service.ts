import { Injectable } from '@angular/core';
import { Observable, of, timeout } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { LocalDatabaseService } from './local-database.service';
import { environment } from '../../environments/environment';

export interface ShopRecord {
  id: string;
  name: string;
  owner: string;
  location: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive';
}

export interface SaleRecord {
  id: string;
  shopId: string;
  date: string;
  amount: number;
  invoiceNumber?: string;
  customer?: string;
  cashier?: string;
  createdAt?: string;
}

export interface InvoiceRecord {
  id: string;
  shopId: string;
  customer: string;
  amount: number;
  date: string;
  invoiceNumber: string;
  referenceNo?: string;
  cashier?: string;
  description?: string;
  totalCases?: number;
  rows?: unknown[];
  fileName?: string;
  fileData?: string;
  fileType?: string;
  status?: 'paid' | 'pending' | 'submitted';
  createdAt?: string;
  submittedAt?: string;
}

export interface DaySheetRecord {
  id: string;
  shopId: string;
  date: string;
  status?: 'draft' | 'submitted';
  draft?: boolean;
  records: unknown[];
  expenses: unknown[];
  additionalProfit: number;
  totalDaySale: number;
  totalExpenses: number;
  grandTotal: number;
  submittedAmount: number;
  presentCashValue?: number;
  cashier?: string;
  submittedAt?: string;
}

export interface ExpenseRecord {
  id: string;
  shopId: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
  createdAt?: string;
}

export interface InventoryRecord {
  id: string;
  shopId: string;
  productName: string;
  stock: number;
  unitPrice: number;
  category?: string;
  updatedAt?: string;
}

export interface OpeningStockRecord {
  id: string;
  shopId: string;
  date: string;
  rows: unknown[];
  status?: 'draft' | 'submitted';
  submittedByName?: string;
  submittedAt?: string | null;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class BusinessDataService {
  constructor(private firestore: FirestoreService, private localDatabase: LocalDatabaseService) {}

  getShops(): Observable<ShopRecord[]> {
    if (this.useLocal()) {
      return this.localDatabase.getCollection<ShopRecord>('shops').pipe(
        catchError(() => of(this.readLocalShops()))
      );
    }

    return this.firestore.getCollection<ShopRecord>('shops').pipe(
      timeout({ first: 8000, with: () => of([]) }),
      catchError(() => of([]))
    );
  }

  getUsers(): Observable<any[]> {
    if (this.useLocal()) {
      return of(this.readLocalUsers());
    }

    return this.firestore.getCollection<any>('users').pipe(
      timeout({ first: 8000, with: () => of([]) }),
      catchError(() => of([]))
    );
  }

  getSales(): Observable<SaleRecord[]> {
    return this.useLocal() ? this.localDatabase.getCollection<SaleRecord>('sales') : this.firestore.getCollection<SaleRecord>('sales');
  }

  getInvoices(): Observable<InvoiceRecord[]> {
    return this.useLocal() ? this.localDatabase.getCollection<InvoiceRecord>('invoices') : this.firestore.getCollection<InvoiceRecord>('invoices');
  }

  getExpenses(): Observable<ExpenseRecord[]> {
    return this.useLocal() ? this.localDatabase.getCollection<ExpenseRecord>('expenses') : this.firestore.getCollection<ExpenseRecord>('expenses');
  }

  getDaySheets(): Observable<DaySheetRecord[]> {
    if (this.useLocal()) {
      return this.localDatabase.getCollection<DaySheetRecord>('daySheets').pipe(
        map((sheets) => sheets.filter((sheet) => sheet.status !== 'draft' && sheet.draft !== true)),
        catchError(() => of(this.readLocalDaySheets()))
      );
    }

    return this.firestore.getCollection<DaySheetRecord>('daySheets').pipe(
      timeout({ first: 8000, with: () => of([]) }),
      map((sheets) => sheets.filter((sheet) => sheet.status !== 'draft' && sheet.draft !== true)),
      catchError(() => of([]))
    );
  }

  getInventory(): Observable<InventoryRecord[]> {
    return this.useLocal() ? this.localDatabase.getCollection<InventoryRecord>('inventory') : this.firestore.getCollection<InventoryRecord>('inventory');
  }

  getOpeningStock(shopId: string): Promise<OpeningStockRecord | null> {
    const id = this.openingStockDocumentId(shopId);
    if (this.useLocal()) {
      return Promise.resolve(this.readLocalOpeningStock(shopId));
    }

    return this.firestore.getDocumentOnce<OpeningStockRecord>('openingStock', id)
      .then((record) => record || this.readLocalOpeningStock(shopId))
      .catch(() => this.readLocalOpeningStock(shopId));
  }

  async saveOpeningStock(data: Partial<OpeningStockRecord>, status: 'draft' | 'submitted' = 'submitted'): Promise<string> {
    const id = this.openingStockDocumentId(data.shopId);
    const recordShopId = String(data.shopId || '');
    const existing = await this.getOpeningStock(recordShopId);
    if (existing && existing.status !== 'draft') {
      throw new Error('Opening stock has already been submitted for this shop.');
    }

    const now = new Date().toISOString();
    const record = {
      ...existing,
      ...data,
      id,
      shopId: recordShopId,
      status,
      createdAt: existing?.createdAt || data.createdAt || now,
      submittedAt: status === 'submitted' ? data.submittedAt || now : null,
    } as OpeningStockRecord;
    const shopId = String(data.shopId || '');

    if (this.useLocal()) {
      await this.localDatabase.createDocument<OpeningStockRecord>('openingStock', record);
    } else {
      await this.firestore.setDocument<OpeningStockRecord>('openingStock', id, record);
    }

    localStorage.setItem(`vinoledger.openingStock.${shopId.toUpperCase()}`, JSON.stringify(record));
    return id;
  }

  private openingStockDocumentId(shopId?: string): string {
    const shopKey = String(shopId || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `opening-stock-${shopKey || 'unknown'}`;
  }

  private readLocalOpeningStock(shopId: string): OpeningStockRecord | null {
    const raw = localStorage.getItem(`vinoledger.openingStock.${String(shopId || '').toUpperCase()}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OpeningStockRecord;
    } catch {
      return null;
    }
  }

  saveShop(data: Partial<ShopRecord>): Promise<string> {
    return this.saveWithLocalFallback('shops', data, () =>
      this.firestore.createDocument<ShopRecord>('shops', data as ShopRecord));
  }

  saveSale(data: Partial<SaleRecord>): Promise<string> {
    return this.saveWithLocalFallback('sales', data, () =>
      this.firestore.createDocument<SaleRecord>('sales', data as SaleRecord));
  }

  saveInvoice(data: Partial<InvoiceRecord>): Promise<string> {
    return this.saveWithLocalFallback('invoices', data, () =>
      this.firestore.createDocument<InvoiceRecord>('invoices', data as InvoiceRecord));
  }

  private isFirebaseConfigured() {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.appId && config.projectId &&
      config.apiKey !== 'YOUR_API_KEY' && config.projectId !== 'YOUR_PROJECT_ID');
  }

  saveDaySheet(data: Partial<DaySheetRecord>): Promise<string> {
    return this.saveDaySheetState({ ...data, status: 'submitted', draft: false });
  }

  saveDaySheetDraft(data: Partial<DaySheetRecord>): Promise<string> {
    return this.saveDaySheetState({ ...data, status: 'draft', draft: true });
  }

  private saveDaySheetState(data: Partial<DaySheetRecord>): Promise<string> {
    const id = this.daySheetDocumentId(data.shopId, data.date);
    const record = { ...data, id } as DaySheetRecord;

    if (this.useLocal()) {
      return this.localDatabase.createDocument<DaySheetRecord>('daySheets', record);
    }

    return this.firestore.setDocument<DaySheetRecord>('daySheets', id, record)
      .then(() => id)
      .catch(() => this.localDatabase.createDocument<DaySheetRecord>('daySheets', record));
  }

  private daySheetDocumentId(shopId?: string, date?: string): string {
    const shopKey = String(shopId || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dateKey = String(date || 'unknown').trim().replace(/[^0-9-]+/g, '');
    return `day-sheet-${shopKey || 'unknown'}-${dateKey || 'unknown'}`;
  }

  deleteDaySheet(id: string): Promise<void> {
    return this.useLocal()
      ? this.localDatabase.deleteDocument('daySheets', id)
      : this.firestore.deleteDocument('daySheets', id);
  }

  saveExpense(data: Partial<ExpenseRecord>): Promise<string> {
    return this.saveWithLocalFallback('expenses', data, () =>
      this.firestore.createDocument<ExpenseRecord>('expenses', data as ExpenseRecord));
  }

  saveInventory(data: Partial<InventoryRecord>): Promise<string> {
    return this.saveWithLocalFallback('inventory', data, () =>
      this.firestore.createDocument<InventoryRecord>('inventory', data as InventoryRecord));
  }

  private useLocal() {
    return !this.isFirebaseConfigured();
  }

  private async saveWithLocalFallback<T extends Record<string, any>>(storeName: string, data: Partial<T>, firestoreSave: () => Promise<string>): Promise<string> {
    if (this.useLocal()) {
      return this.localDatabase.createDocument<T>(storeName, data as T);
    }

    try {
      return await firestoreSave();
    } catch {
      return this.localDatabase.createDocument<T>(storeName, data as T);
    }
  }

  private readLocalShops(): ShopRecord[] {
    const localShops = this.readLocalStorageJson<any[]>('vinoledger.shop.list', []);
    const registeredShops = this.readLocalStorageJson<any[]>('vinoledger.registered.shops', []);
    const fallbackShops = [
      {
        shopId: 'KKD41',
        id: 'KKD41',
        name: 'VinoLedger Test Shop',
        ownerName: 'Y Bathalaswamy',
        owner: 'Y Bathalaswamy',
        location: 'Kakinada',
        email: 'owner@vinoleger.com',
        phone: '+91-90000-00001',
        status: 'active',
      }
    ];

    const merged = [...registeredShops, ...localShops, ...fallbackShops].filter((shop) => shop && (shop['shopId'] || shop['id']));
    const unique = new Map<string, ShopRecord>();

    merged.forEach((shop: any) => {
      const id = String(shop['shopId'] || shop['id'] || '').trim();
      if (!id) return;
      unique.set(id.toUpperCase(), {
        id,
        name: shop['name'] || shop['shopId'] || shop['id'] || '',
        owner: shop['ownerName'] || shop['owner'] || 'N/A',
        location: shop['location'] || '',
        email: shop['email'],
        phone: shop['phone'],
        status: shop['status'],
      });
    });

    return Array.from(unique.values());
  }

  private readLocalDaySheets(): DaySheetRecord[] {
    const history = this.readLocalStorageJson<any[]>('vinoledger.daySheetSubmissions', []);
    return history
      .map((item: any) => ({
        id: String(item['id'] || item['submittedAt'] || `${Date.now()}-${Math.random()}`),
        shopId: String(item['shopId'] || item['shop']?.['id'] || ''),
        date: String(item['date'] || ''),
        records: Array.isArray(item['records']) ? item['records'] : [],
        expenses: Array.isArray(item['expenses']) ? item['expenses'] : [],
        additionalProfit: Number(item['additionalProfit'] || 0),
        totalDaySale: Number(item['totalDaySale'] || 0),
        totalExpenses: Number(item['totalExpenses'] || 0),
        grandTotal: Number(item['grandTotal'] || 0),
        submittedAmount: Number(item['submittedAmount'] || 0),
        cashier: String(item['cashier'] || item['submittedBy'] || item['cashierName'] || ''),
        submittedAt: String(item['submittedAt'] || ''),
      }))
      .filter((sheet) => sheet.shopId && sheet.date);
  }

  private readLocalUsers(): any[] {
    const localAccounts = this.readLocalStorageJson<any[]>('vinoledger.registered.accounts', []);
    const localUsers = localAccounts.map((entry: any) => ({
      id: entry?.user?.id || entry?.id,
      role: entry?.user?.role || entry?.role,
      name: entry?.user?.name || entry?.name,
      email: entry?.user?.email || entry?.email,
      shopId: entry?.user?.shopId || entry?.shopId,
      contactNumber: entry?.user?.contactNumber || entry?.contactNumber,
      address: entry?.user?.address || entry?.address,
    }));

    return localUsers.filter((user) => user && user.email);
  }

  private readLocalStorageJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : fallback;
    } catch {
      return fallback;
    }
  }
}

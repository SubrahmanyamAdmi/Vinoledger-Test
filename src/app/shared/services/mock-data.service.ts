import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  constructor() {}

  getDashboardSummary() {
    const payload = {
      totalShops: 12,
      totalSalesToday: 12450,
      lowStockCount: 8,
      pendingExpenses: 3
    };
    return of(payload).pipe(delay(300));
  }

  getInventory(page = 1) {
    const items = Array.from({ length: 20 }).map((_, i) => ({
      id: i + 1,
      name: `Wine ${i + 1}`,
      brand: 'Local',
      category: 'Red',
      stock: Math.floor(Math.random() * 100),
      price: (Math.random() * 1000).toFixed(2)
    }));
    return of({ items, total: 200 }).pipe(delay(300));
  }

  getExpenses() {
    const items = Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1,
      date: new Date().toISOString(),
      amount: (Math.random() * 500).toFixed(2),
      note: 'Sample expense'
    }));
    return of(items).pipe(delay(300));
  }
}

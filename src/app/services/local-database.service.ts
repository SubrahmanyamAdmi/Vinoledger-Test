import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';

export type LocalRecord = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class LocalDatabaseService {
  private readonly databaseName = 'vinoledger-local';
  private readonly version = 2;
  private readonly stores = ['shops', 'sales', 'invoices', 'expenses', 'daySheets', 'inventory', 'openingStock'];
  private databasePromise?: Promise<IDBDatabase>;

  getCollection<T extends LocalRecord>(storeName: string): Observable<T[]> {
    return from(this.readAll<T>(storeName));
  }

  createDocument<T extends LocalRecord>(storeName: string, data: Partial<T>): Promise<string> {
    const id = String(data['id'] || `${storeName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const record = { ...data, id, createdAt: data['createdAt'] || new Date().toISOString() };
    return this.write(storeName, record).then(() => id);
  }

  createDocumentIfAbsent<T extends LocalRecord>(storeName: string, data: Partial<T>): Promise<string | null> {
    const id = String(data['id'] || `${storeName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const record = { ...data, id, createdAt: data['createdAt'] || new Date().toISOString() };
    return this.open().then((database) => new Promise<string | null>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).add(record);
      request.onsuccess = () => resolve(id);
      request.onerror = (event) => {
        if (request.error?.name === 'ConstraintError') {
          event.preventDefault();
          resolve(null);
          return;
        }
        reject(request.error || new Error(`Unable to save local ${storeName} data.`));
      };
    }));
  }

  deleteDocument(storeName: string, id: string): Promise<void> {
    return this.open().then((database) => new Promise<void>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Unable to delete local ${storeName} data.`));
    }));
  }

  private readAll<T extends LocalRecord>(storeName: string): Promise<T[]> {
    return this.open().then((database) => new Promise<T[]>((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error || new Error(`Unable to read local ${storeName} data.`));
    }));
  }

  private write(storeName: string, record: LocalRecord): Promise<void> {
    return this.open().then((database) => new Promise<void>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Unable to save local ${storeName} data.`));
    }));
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.version);
      request.onupgradeneeded = () => {
        const database = request.result;
        this.stores.forEach((storeName) => {
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open the local VinoLedger database.'));
    });
    return this.databasePromise;
  }
}
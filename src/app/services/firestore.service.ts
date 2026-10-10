import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  QueryConstraint,
  type DocumentData,
  type WithFieldValue,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { map, from } from 'rxjs';

export type FirestoreItem = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private readonly firestore = getFirestore();

  getCollection<T extends FirestoreItem>(
    path: string,
    constraints: QueryConstraint[] = [],
    order: string | null = null,
    maxCount?: number,
  ): Observable<T[]> {
    const ref = collection(this.firestore, path);
    const queryArgs: QueryConstraint[] = [...constraints];

    if (order) {
      queryArgs.push(orderBy(order));
    }

    if (maxCount) {
      queryArgs.push(limit(maxCount));
    }

    return from(getDocs(query(ref, ...queryArgs))).pipe(
      map((snapshot) => snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Record<string, unknown>),
      } as unknown as T)))
    );
  }

  getDocument<T extends FirestoreItem>(path: string, id: string): Observable<T | null> {
    return from(getDoc(doc(this.firestore, path, id))).pipe(
      map((snapshot) => {
        if (!snapshot.exists()) {
          return null;
        }

        return { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as unknown as T;
      })
    );
  }

  getDocumentOnce<T extends FirestoreItem>(path: string, id: string): Promise<T | null> {
    return getDoc(doc(this.firestore, path, id)).then((snapshot) => {
      if (!snapshot.exists()) {
        return null;
      }

      return { id: snapshot.id, ...(snapshot.data() as Record<string, unknown>) } as unknown as T;
    });
  }

  getDocumentsOnce<T extends FirestoreItem>(path: string, constraints: QueryConstraint[] = []): Promise<T[]> {
    return getDocs(query(collection(this.firestore, path), ...constraints)).then((snapshot) => {
      return snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Record<string, unknown>),
      } as unknown as T));
    });
  }

  async createDocument<T extends FirestoreItem>(path: string, data: WithFieldValue<T>): Promise<string> {
    await this.ensureAuthenticated();
    const ref = collection(this.firestore, path);
    return this.withTimeout(
      addDoc(ref, { ...data, createdAt: serverTimestamp() } as WithFieldValue<DocumentData>).then((saved) => saved.id)
    );
  }

  async setDocument<T extends FirestoreItem>(path: string, id: string, data: WithFieldValue<T>): Promise<void> {
    await this.ensureAuthenticated();
    const ref = doc(this.firestore, path, id);
    const payload = this.cleanForFirestore({
      ...(data as Record<string, unknown>),
      updatedAt: new Date().toISOString()
    } as Record<string, unknown>);
    return this.withTimeout(setDoc(ref, payload as WithFieldValue<DocumentData>, { merge: true }));
  }

  async createDocumentIfAbsent<T extends FirestoreItem>(path: string, id: string, data: WithFieldValue<T>): Promise<boolean> {
    await this.ensureAuthenticated();
    const ref = doc(this.firestore, path, id);
    return this.withTimeout(runTransaction(this.firestore, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) {
        return false;
      }

      const payload = this.cleanForFirestore({
        ...(data as Record<string, unknown>),
        id,
        createdAt: new Date().toISOString(),
      });
      transaction.set(ref, payload as WithFieldValue<DocumentData>);
      return true;
    }));
  }

  async updateDocument<T extends FirestoreItem>(path: string, id: string, data: Partial<T>): Promise<void> {
    await this.ensureAuthenticated();
    const ref = doc(this.firestore, path, id);
    return this.withTimeout(updateDoc(ref, { ...data, updatedAt: serverTimestamp() } as Partial<DocumentData>));
  }

  deleteDocument(path: string, id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, path, id));
  }

  whereEquals(field: string, value: string): QueryConstraint {
    return where(field, '==', value);
  }

  private async ensureAuthenticated(): Promise<void> {
    const auth = getAuth();
    if (auth.currentUser) {
      return;
    }

    // Firebase rules are intentionally permissive for this dev project, so do not force
    // anonymous sign-in here. Anonymous auth can fail with ADMIN_ONLY_OPERATION when it is
    // disabled in the Firebase project configuration.
  }

  private cleanForFirestore<T>(value: T): T {
    if (value === undefined) {
      return undefined as T;
    }

    if (value === null) {
      return null as T;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.cleanForFirestore(item))
        .filter((item) => item !== undefined) as T;
    }

    if (typeof value === 'object') {
      const cleaned: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
        const nextValue = this.cleanForFirestore(item);
        if (nextValue !== undefined) {
          cleaned[key] = nextValue;
        }
      });
      return cleaned as T;
    }

    return value;
  }

  private withTimeout<T>(request: Promise<T>, timeoutMs = 8000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Firebase did not respond. Check the Firebase configuration and network connection.'));
      }, timeoutMs);

      request.then(
        (value) => {
          window.clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      );
    });
  }
}

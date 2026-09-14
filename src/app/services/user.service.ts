import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { User, UserRole } from '../models/auth.model';

export interface UserProfile extends User {
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly collectionPath = 'users';

  constructor(private firestore: FirestoreService) {}

  getUserById(uid: string): Observable<UserProfile | null> {
    return this.firestore.getDocument<UserProfile>(this.collectionPath, uid);
  }

  getUserByEmail(email: string): Promise<UserProfile | null> {
    return this.firestore.getDocumentsOnce<UserProfile>(this.collectionPath, [
      this.firestore.whereEquals('email', email.trim().toLowerCase())
    ]).then((users) => users[0] ?? null);
  }

  saveUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    return this.firestore.setDocument<UserProfile>(this.collectionPath, uid, {
      id: uid,
      email: data.email ?? '',
      role: (data.role ?? 'User') as UserRole,
      name: data.name ?? 'User',
      shopId: data.shopId,
      ...data,
    });
  }

  updateUserRole(uid: string, role: UserRole): Promise<void> {
    return this.firestore.updateDocument<UserProfile>(this.collectionPath, uid, { role });
  }
}

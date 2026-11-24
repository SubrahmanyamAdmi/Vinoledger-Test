import { Injectable, NgZone, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as updateFirebasePassword,
  User as FirebaseUser,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { from, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoginRequest, LoginResponse, User, UserRole } from '../models/auth.model';
import { UserService } from './user.service';
import { environment } from '../../environments/environment';

export interface ShopPersonRegistration {
  name: string;
  email: string;
  contactNumber: string;
  address: string;
}

export interface ShopRegistration {
  shopOwner: ShopPersonRegistration;
  shopName: string;
  shopId: string;
  shopLocation: string;
  shopOpenDate: string;
  cashiers: ShopPersonRegistration[];
}

export interface ShopAccountProfile {
  role: 'Owner' | 'Cashier';
  name: string;
  userId: string;
  email: string;
}

export const SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'vinoledger.lastActivity';
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSignal = signal<User | null>(null);
  private tokenSignal = signal<string | null>(null);

  public currentUser = this.currentUserSignal.asReadonly();
  public token = this.tokenSignal.asReadonly();
  public isLoggedIn = computed(() => !!this.tokenSignal());
  public userRole = computed(() => this.currentUserSignal()?.role ?? null);

  private readonly auth = getAuth();
  private readonly firestore = getFirestore();
  private readonly sessionReady: Promise<void>;
  private idleCheckTimer: ReturnType<typeof setInterval> | null = null;
  private lastWrite = 0;

  constructor(
    private ngZone: NgZone,
    private router: Router,
    private userService: UserService
  ) {
    this.removeLegacyPasswordStorage();
    this.sessionReady = this.restoreFirebaseSession();
  }

  waitForSession(): Promise<void> {
    return this.sessionReady;
  }

  login(payload: LoginRequest) {
    return from(this.authenticate(payload)).pipe(
      tap((response) => this.persistSession(response)),
      catchError((error) => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  logout(navigate = true) {
    this.stopIdleTracking();
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    firebaseSignOut(this.auth).catch((error) => console.error('Firebase sign-out failed.', error));
    if (navigate) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  private startIdleTracking() {
    this.stopIdleTracking();
    this.recordActivity(true);
    this.ngZone.runOutsideAngular(() => {
      IDLE_EVENTS.forEach((name) => window.addEventListener(name, this.activityHandler, { passive: true }));
      this.idleCheckTimer = setInterval(() => this.checkIdle(), 15000);
    });
  }

  private stopIdleTracking() {
    if (typeof window === 'undefined') return;
    IDLE_EVENTS.forEach((name) => window.removeEventListener(name, this.activityHandler));
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
  }

  private readonly activityHandler = () => this.recordActivity();

  private recordActivity(force = false) {
    const now = Date.now();
    if (force || now - this.lastWrite > 5000) {
      this.lastWrite = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }
  }

  private isIdleExpired(): boolean {
    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return !!last && Date.now() - last > SESSION_IDLE_TIMEOUT_MS;
  }

  private checkIdle() {
    if (this.tokenSignal() && this.isIdleExpired()) {
      this.ngZone.run(() => this.logout());
    }
  }

  hasRole(roles: UserRole | UserRole[]): boolean {
    const role = this.userRole();
    if (!role) return false;
    return (Array.isArray(roles) ? roles : [roles]).includes(role);
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.currentUserSignal();
    const firebaseUser = this.auth.currentUser;
    if (!user || !firebaseUser || !user.email) {
      throw new Error('Sign in again before changing your password.');
    }

    await reauthenticateWithCredential(
      firebaseUser,
      EmailAuthProvider.credential(user.email, currentPassword)
    );
    await updateFirebasePassword(firebaseUser, newPassword);
  }

  async registerShop(registration: ShopRegistration): Promise<{ shop: any; profiles: ShopAccountProfile[] }> {
    if (!this.isFirebaseConfigured()) {
      throw new Error('Firebase Authentication must be configured before registering shops.');
    }

    const normalizedOwner = this.normalizePerson(registration.shopOwner);
    const normalizedCashiers = registration.cashiers.map((cashier) => this.normalizePerson(cashier));
    const validCashiers = normalizedCashiers.filter((cashier): cashier is ShopPersonRegistration => cashier !== null);
    if (!normalizedOwner || validCashiers.length !== registration.cashiers.length) {
      throw new Error('Each contact number must contain exactly 10 digits. Indian +91 will be added automatically.');
    }

    const shopId = registration.shopId.trim().toUpperCase();
    const existingShops = this.getRegisteredShops();
    if ((await getDoc(doc(this.firestore, 'shops', shopId))).exists()) {
      throw new Error('A shop with this shop ID is already registered.');
    }

    const accounts = [
      this.createProfile(normalizedOwner, 'Owner', shopId, 'OWNER'),
      ...validCashiers.map((cashier, index) => this.createProfile(cashier, 'Cashier', shopId, `CASH${index + 1}`)),
    ];
    const shop = {
      id: shopId,
      shopId,
      name: registration.shopName.trim(),
      ownerName: normalizedOwner.name,
      ownerEmail: normalizedOwner.email,
      ownerContactNumber: normalizedOwner.contactNumber,
      ownerAddress: normalizedOwner.address,
      location: registration.shopLocation.trim(),
      openingDate: registration.shopOpenDate,
      cashiers: validCashiers,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(this.firestore, 'shops', shopId), { ...shop, createdAt: serverTimestamp() });
    await Promise.all(accounts.map(({ user }) => this.userService.saveUserProfile(user.id, user)));
    localStorage.setItem('vinoledger.registered.shops', JSON.stringify([...existingShops, shop]));

    return {
      shop,
      profiles: accounts.map(({ user }) => ({
        role: user.role === 'User' ? 'Cashier' : 'Owner',
        name: user.name ?? '',
        userId: user.userId ?? user.id,
        email: user.email,
      })),
    };
  }

  getRegisteredShops(): any[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem('vinoledger.registered.shops') ?? '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn('Could not read cached registered shops.', error);
      return [];
    }
  }

  async refreshRegisteredShopsFromFirestore(): Promise<any[]> {
    if (!this.isFirebaseConfigured()) {
      return this.getRegisteredShops();
    }

    try {
      const snapshot = await this.fetchRegisteredShopDocuments();
      const remoteShops = snapshot.docs.map((shopSnapshot) => ({
        ...shopSnapshot.data(),
        id: shopSnapshot.id,
        shopId: shopSnapshot.id,
      }));
      localStorage.setItem('vinoledger.registered.shops', JSON.stringify(remoteShops));
      return remoteShops;
    } catch (error) {
      console.error('Could not refresh registered shops from Firestore.', error);
      return this.getRegisteredShops();
    }
  }

  private fetchRegisteredShopDocuments() {
    return getDocs(collection(this.firestore, 'shops'));
  }

  private async authenticate(payload: LoginRequest): Promise<LoginResponse> {
    if (!this.isFirebaseConfigured()) {
      throw new Error('Firebase Authentication is not configured for this application.');
    }

    await this.refreshRegisteredShopsFromFirestore();

    const email = payload.email.trim();
    if (!email.includes('@')) {
      throw new Error('Sign in with the email address registered to your Firebase Auth account.');
    }

    const credential = await signInWithEmailAndPassword(this.auth, email, payload.password);
    const mappedUser = await this.mapFirebaseUser(credential.user);
    const user: User = {
      ...mappedUser,
      id: credential.user.uid,
      email: credential.user.email ?? email,
    };
    await this.userService.saveUserProfile(credential.user.uid, user);

    return { token: await credential.user.getIdToken(), user };
  }

  private isFirebaseConfigured(): boolean {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.appId && config.projectId &&
      config.apiKey !== 'YOUR_API_KEY' && config.projectId !== 'YOUR_PROJECT_ID');
  }

  private normalizePerson(person: ShopPersonRegistration): ShopPersonRegistration | null {
    const digits = String(person.contactNumber || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (digits.length !== 10) return null;
    return {
      name: person.name.trim(),
      email: person.email.trim().toLowerCase(),
      contactNumber: `+91${digits}`,
      address: person.address.trim(),
    };
  }

  private createProfile(person: ShopPersonRegistration, role: 'Owner' | 'Cashier', shopId: string, suffix: string) {
    const userId = `${shopId}-${suffix}`;
    const user: User = {
      id: userId,
      userId,
      email: person.email.trim().toLowerCase(),
      role: role === 'Owner' ? 'Owner' : 'User',
      name: person.name.trim(),
      shopId,
      contactNumber: person.contactNumber.trim(),
      address: person.address.trim(),
    };
    return { user };
  }

  private async mapFirebaseUser(firebaseUser: FirebaseUser): Promise<User> {
    const profileSnapshot = await getDoc(doc(this.firestore, 'users', firebaseUser.uid));
    const profile = profileSnapshot.exists()
      ? { ...profileSnapshot.data(), id: profileSnapshot.id } as User
      : await this.userService.getUserByEmail(firebaseUser.email ?? '');
    if (!profile?.role) {
      throw new Error('No VinoLedger user profile is linked to this Firebase account.');
    }

    return { ...profile, id: firebaseUser.uid, email: firebaseUser.email ?? profile.email };
  }

  private removeLegacyPasswordStorage(): void {
    localStorage.removeItem('token');
    Object.keys(localStorage)
      .filter((key) => key.startsWith('password:'))
      .forEach((key) => localStorage.removeItem(key));

    const accountsKey = 'vinoledger.registered.accounts';
    const cachedAccounts = localStorage.getItem(accountsKey);
    if (!cachedAccounts) return;

    try {
      const accounts = JSON.parse(cachedAccounts);
      if (Array.isArray(accounts)) {
        localStorage.setItem(accountsKey, JSON.stringify(accounts.map((account) => {
          if (!account || typeof account !== 'object') return account;
          const { password: _password, ...safeAccount } = account;
          return safeAccount;
        })));
      } else {
        localStorage.removeItem(accountsKey);
      }
    } catch (error) {
      console.warn('Could not migrate cached registered accounts; removing the unsafe cache.', error);
      localStorage.removeItem(accountsKey);
    }
  }

  private persistSession(response: LoginResponse) {
    this.tokenSignal.set(response.token);
    this.currentUserSignal.set(response.user);
    localStorage.setItem('user', JSON.stringify(response.user));
    this.startIdleTracking();
    if (response.user.shopId) {
      const shop = this.getRegisteredShops().find((registeredShop) => registeredShop.shopId === response.user.shopId);
      if (shop) {
        sessionStorage.setItem('vinoledger.shop', JSON.stringify({
          id: shop.shopId,
          name: shop.name,
          owner: shop.ownerName,
          cashier: response.user.role === 'User' ? response.user.name : undefined,
          openingDate: shop.openingDate || shop.createdAt,
          location: shop.location,
        }));
      }
    }
  }

  private async restoreFirebaseSession(): Promise<void> {
    try {
      await this.auth.authStateReady();
      const firebaseUser = this.auth.currentUser;
      if (!firebaseUser) {
        localStorage.removeItem('user');
        return;
      }
      if (this.isIdleExpired()) {
        this.logout(false);
        return;
      }
      const user = await this.mapFirebaseUser(firebaseUser);
      this.tokenSignal.set(await firebaseUser.getIdToken());
      this.currentUserSignal.set(user);
      localStorage.setItem('user', JSON.stringify(user));
      this.startIdleTracking();
    } catch (error) {
      console.error('Could not restore the Firebase session.', error);
      await firebaseSignOut(this.auth);
      this.tokenSignal.set(null);
      this.currentUserSignal.set(null);
      localStorage.removeItem('user');
    }
  }
}

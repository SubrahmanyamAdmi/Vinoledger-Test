import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, setDoc, serverTimestamp } from 'firebase/firestore';
import { from, of, throwError } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
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

export interface GeneratedCredential {
  role: 'Owner' | 'Cashier';
  name: string;
  userId: string;
  password: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth';

  private currentUserSignal = signal<User | null>(null);
  private tokenSignal = signal<string | null>(null);

  public currentUser = this.currentUserSignal.asReadonly();
  public token = this.tokenSignal.asReadonly();

  public isLoggedIn = computed(() => !!this.tokenSignal());
  public userRole = computed(() => this.currentUserSignal()?.role ?? null);

  private readonly auth = getAuth();
  private readonly firestore = getFirestore();

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService
  ) {
    this.restoreSession();
  }

  login(payload: LoginRequest) {
    return from(Promise.all([
      this.refreshRegisteredAccountsFromFirestore(),
      this.refreshRegisteredShopsFromFirestore(),
    ])).pipe(
      switchMap(async () => {
        const registeredUser = this.getRegisteredUser(payload);
        if (registeredUser) {
          return this.loginRegisteredUser(registeredUser, payload.password);
        }

        const identifier = payload.email.trim();
        if (!identifier.includes('@')) {
          const profile = await this.getRegisteredProfileById(identifier);
          if (!profile) {
            throw new Error('User ID was not found. Confirm this user is registered for the shop.');
          }
          return this.loginProfileUser(profile, identifier, payload.password);
        }

        const userCredential = await signInWithEmailAndPassword(this.auth, identifier, payload.password);
        const token = await userCredential.user.getIdToken();
        const user = await this.mapFirebaseUser(userCredential.user);
        return { token, user } as LoginResponse;
      }),
      tap((res) => this.persistSession(res)),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout() {
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    firebaseSignOut(this.auth).catch(() => undefined);
    this.router.navigate(['/login']);
  }

  hasRole(roles: UserRole | UserRole[]): boolean {
    const role = this.userRole();
    if (!role) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(role);
  }

  updatePassword(currentPassword: string, newPassword: string): boolean {
    const user = this.currentUserSignal();
    if (!user || this.getStoredPassword(user.email) !== currentPassword) {
      return false;
    }

    localStorage.setItem(`password:${user.email}`, newPassword);
    return true;
  }

  async registerShop(registration: ShopRegistration): Promise<{ shop: any; credentials: GeneratedCredential[] }> {
    const normalizedOwner = this.normalizePerson(registration.shopOwner);
    const normalizedCashiers = registration.cashiers.map((cashier) => this.normalizePerson(cashier));
    const validCashiers = normalizedCashiers.filter((cashier): cashier is ShopPersonRegistration => cashier !== null);
    if (!normalizedOwner || validCashiers.length !== registration.cashiers.length) {
      throw new Error('Each contact number must contain exactly 10 digits. Indian +91 will be added automatically.');
    }

    const shopId = registration.shopId.trim().toUpperCase();
    const firebaseConfigured = this.isFirebaseConfigured();
    const existingShops = firebaseConfigured ? [] : this.getRegisteredShops();
    if ((!firebaseConfigured && existingShops.some((shop) => String(shop.shopId || shop.id || '').toUpperCase() === shopId)) ||
      (firebaseConfigured && (await getDoc(doc(this.firestore, 'shops', shopId))).exists())) {
      throw new Error('A shop with this shop ID is already registered.');
    }

    const ownerCredential = this.createCredential(normalizedOwner, 'Owner', shopId, 'OWNER');
    const cashierCredentials = validCashiers.map((cashier, index) =>
      this.createCredential(cashier, 'Cashier', shopId, `CASH${index + 1}`)
    );
    const accounts = [ownerCredential, ...cashierCredentials];
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

    if (firebaseConfigured) {
      await setDoc(doc(this.firestore, 'shops', shopId), { ...shop, createdAt: serverTimestamp() });
      await Promise.all(accounts.map(({ user }) => this.userService.saveUserProfile(user.id, user)));
      // Demo-only: credentials are stored in Firestore so registered shops can log in from any browser/device.
      await Promise.all(accounts.map(({ user, password }) =>
        setDoc(doc(this.firestore, 'registeredAccounts', String(user.userId || user.id)), { user, password })));
    }

    localStorage.setItem('vinoledger.registered.shops', JSON.stringify([...existingShops, shop]));
    const existingAccounts = this.getRegisteredAccounts();
    localStorage.setItem('vinoledger.registered.accounts', JSON.stringify([...existingAccounts, ...accounts]));
    return { shop, credentials: accounts.map(({ user, password }) => ({
      role: user.role === 'User' ? 'Cashier' : 'Owner',
      name: user.name ?? '',
      userId: user.userId ?? user.id,
      password,
      email: user.email,
    })) };
  }

  getRegisteredShops(): any[] {
    return this.readStorage<any[]>('vinoledger.registered.shops', []);
  }

  async refreshRegisteredAccountsFromFirestore(): Promise<{ user: User; password: string }[]> {
    if (!this.isFirebaseConfigured()) {
      return this.getRegisteredAccounts();
    }

    try {
      const snapshot = await getDocs(collection(this.firestore, 'registeredAccounts'));
      const remoteAccounts = snapshot.docs.map((docSnapshot) => docSnapshot.data() as { user: User; password: string });
      localStorage.setItem('vinoledger.registered.accounts', JSON.stringify(remoteAccounts));
      return remoteAccounts;
    } catch {
      return this.getRegisteredAccounts();
    }
  }

  async refreshRegisteredShopsFromFirestore(): Promise<any[]> {
    if (!this.isFirebaseConfigured()) {
      return this.getRegisteredShops();
    }

    try {
      const snapshot = await getDocs(collection(this.firestore, 'shops'));
      const remoteShops = snapshot.docs.map((docSnapshot) => ({ ...docSnapshot.data(), id: docSnapshot.id, shopId: docSnapshot.id }));
      localStorage.setItem('vinoledger.registered.shops', JSON.stringify(remoteShops));
      return remoteShops;
    } catch {
      return this.getRegisteredShops();
    }
  }

  private isFirebaseConfigured() {
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

  private async loginRegisteredUser(
    registeredUser: { user: User; password: string },
    password: string
  ): Promise<LoginResponse> {
    if (this.isFirebaseConfigured()) {
      try {
        const firebaseUser = await this.ensureFirebaseAuthUser(registeredUser.user.email, password);
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          const mappedUser = await this.mapFirebaseUser(firebaseUser);
          const userId = registeredUser.user.userId || registeredUser.user.id;
          const registeredProfile = await this.getRegisteredProfileById(userId);
          const user: User = {
            ...registeredUser.user,
            ...registeredProfile,
            ...mappedUser,
            id: firebaseUser.uid,
            userId: registeredProfile?.userId || registeredUser.user.userId || userId,
            email: firebaseUser.email || registeredProfile?.email || registeredUser.user.email,
            role: registeredProfile?.role || registeredUser.user.role,
            name: registeredProfile?.name || registeredUser.user.name || mappedUser.name,
            shopId: registeredProfile?.shopId || registeredUser.user.shopId,
          };
          await this.userService.saveUserProfile(firebaseUser.uid, user);
          return { token, user };
        }
      } catch {
        // Fall back to the local registered-user session if Firebase auth is unavailable.
      }
    }

    return {
      token: `registered-${registeredUser.user.id}`,
      user: registeredUser.user,
    };
  }

  private async getRegisteredProfileById(identifier: string): Promise<User | null> {
    if (!this.isFirebaseConfigured()) return null;

    const normalizedId = identifier.trim().toUpperCase();
    const profileSnapshot = await getDoc(doc(this.firestore, 'users', normalizedId));
    if (profileSnapshot.exists()) {
      return { ...profileSnapshot.data(), id: profileSnapshot.id } as User;
    }

    const accountSnapshot = await getDoc(doc(this.firestore, 'registeredAccounts', normalizedId));
    if (!accountSnapshot.exists()) return null;

    const account = accountSnapshot.data() as { user?: User };
    return account.user ?? null;
  }

  private async loginProfileUser(profile: User, userId: string, password: string): Promise<LoginResponse> {
    if (!profile.email) {
      throw new Error('This user profile does not have an email address for authentication.');
    }

    const firebaseUser = await this.ensureFirebaseAuthUser(profile.email, password);
    if (!firebaseUser) {
      throw new Error('Firebase Authentication is not configured for this application.');
    }

    const user: User = {
      ...profile,
      id: firebaseUser.uid,
      userId: profile.userId || userId,
    };
    await this.userService.saveUserProfile(firebaseUser.uid, user);
    return { token: await firebaseUser.getIdToken(), user };
  }

  private async ensureFirebaseAuthUser(email: string, password: string): Promise<FirebaseUser | null> {
    if (!this.isFirebaseConfigured() || !email.includes('@')) {
      return null;
    }

    try {
      const result = await signInWithEmailAndPassword(this.auth, email.trim(), password);
      return result.user;
    } catch (error: any) {
      const shouldCreateUser = error?.code === 'auth/user-not-found' ||
        error?.code === 'auth/invalid-login-credentials' || error?.code === 'auth/invalid-credential';
      if (!shouldCreateUser) {
        throw error;
      }

      try {
        const result = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
        return result.user;
      } catch (createError: any) {
        if (createError?.code === 'auth/email-already-in-use') {
          const result = await signInWithEmailAndPassword(this.auth, email.trim(), password);
          return result.user;
        }

        throw createError;
      }
    }
  }

  private persistSession(res: LoginResponse) {
    this.tokenSignal.set(res.token);
    this.currentUserSignal.set(res.user);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    if (res.user.shopId) {
      const shop = this.getRegisteredShops().find((registeredShop) => registeredShop.shopId === res.user.shopId);
      if (shop) {
        sessionStorage.setItem('vinoledger.shop', JSON.stringify({
          id: shop.shopId,
          name: shop.name,
          owner: shop.ownerName,
          cashier: res.user.role === 'User' ? res.user.name : undefined,
          openingDate: shop.openingDate || shop.createdAt,
          location: shop.location,
        }));
      }
    }
  }

  private async mapFirebaseUser(firebaseUser: FirebaseUser): Promise<User> {
    const userRef = doc(this.firestore, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);

    const extra = snap.exists() ? (snap.data() as Partial<User>) : {};
    const email = firebaseUser.email ?? extra.email ?? '';
    const role = (extra.role as UserRole | undefined) ?? this.deriveRoleFromEmail(email);
    const mappedUser: User = {
      id: firebaseUser.uid,
      email,
      role,
      name: extra.name ?? firebaseUser.displayName ?? 'User',
      shopId: extra.shopId ?? undefined,
    };

    if (!snap.exists()) {
      await this.userService.saveUserProfile(firebaseUser.uid, mappedUser);
    }

    return mappedUser;
  }

  private deriveRoleFromEmail(email: string): UserRole {
    const lower = email.trim().toLowerCase();
    if (lower.includes('admin')) return 'Admin';
    if (lower.includes('owner')) return 'Owner';
    return 'User';
  }

  private getStoredPassword(email: string): string | null {
    return localStorage.getItem(`password:${email}`) ??
      this.getRegisteredAccounts().find((account) => account.user.email === email)?.password ?? null;
  }

  private createCredential(person: ShopPersonRegistration, role: 'Owner' | 'Cashier', shopId: string, suffix: string) {
    const userId = `${shopId}-${suffix}`;
    const password = `${shopId}@${role}1`;
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
    return { user, password };
  }

  private getRegisteredUser(payload: LoginRequest): { user: User; password: string } | null {
    const identifier = payload.email.trim().toLowerCase();
    const normalizedPassword = payload.password;
    const matches = this.getRegisteredAccounts().filter((entry) => {
      const userEmail = entry.user.email?.toLowerCase() ?? '';
      const userId = entry.user.userId?.toLowerCase() ?? '';
      const shopId = entry.user.shopId?.toLowerCase() ?? '';
      return entry.password === normalizedPassword &&
        (userEmail === identifier || userId === identifier || shopId === identifier);
    });

    if (matches.length === 0) return null;

    return matches.find((entry) => entry.user.role === 'Owner') ?? matches[0];
  }

  private getRegisteredAccounts(): { user: User; password: string }[] {
    return this.readStorage<{ user: User; password: string }[]>('vinoledger.registered.accounts', []);
  }

  private readStorage<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)) as T;
    } catch {
      return fallback;
    }
  }

  private seedRegisteredAccounts(): void {
    const existingAccounts = this.getRegisteredAccounts();
    const demoOwnerAccount = {
      user: {
        id: '40',
        userId: '40',
        email: '40',
        role: 'Owner',
        name: 'Boss',
        shopId: '24083KKD40',
        contactNumber: '+919000000001',
        address: 'Kakinada',
      },
      password: '40',
    };

    const hasDemoOwner = existingAccounts.some((account) =>
      String(account.user?.id || '').toLowerCase() === '40' ||
      String(account.user?.userId || '').toLowerCase() === '40' ||
      String(account.user?.email || '').toLowerCase() === '40'
    );

    if (existingAccounts.length > 0 && hasDemoOwner) {
      return;
    }

    const mergedAccounts = hasDemoOwner ? existingAccounts : [...existingAccounts, demoOwnerAccount];
    localStorage.setItem('vinoledger.registered.accounts', JSON.stringify(mergedAccounts));
    localStorage.setItem('password:40', '40');

    if (existingAccounts.length > 0) {
      return;
    }

    const shopId = '24083KKD40';
    const shop = {
      id: shopId,
      shopId,
      name: '24083KKD40 Shop',
      ownerName: 'Boss',
      ownerContactNumber: '+919000000001',
      ownerAddress: 'Kakinada',
      location: 'Kakinada',
      openingDate: '2026-09-01',
      cashiers: [{ name: 'Cashier 1', email: 'cashier@vinoleger.com', contactNumber: '+919000000002', address: 'Kakinada' }],
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const inventory = [
      { id: 'INV-1001', shopId, productName: 'Premium Red Wine', stock: 25, unitPrice: 980, category: 'Wine' },
      { id: 'INV-1002', shopId, productName: 'Vintage White Wine', stock: 18, unitPrice: 870, category: 'Wine' },
      { id: 'INV-1003', shopId, productName: 'Beer Case', stock: 42, unitPrice: 520, category: 'Beer' },
      { id: 'INV-1004', shopId, productName: 'Soft Drinks', stock: 64, unitPrice: 120, category: 'Beverage' },
    ];

    const invoices = [
      { id: 'INV-001', shopId, customer: 'Shop Customer A', amount: 1240, date: '2026-09-01', invoiceNumber: 'INV-001', status: 'paid' },
      { id: 'INV-002', shopId, customer: 'Shop Customer B', amount: 840, date: '2026-09-02', invoiceNumber: 'INV-002', status: 'paid' },
      { id: 'INV-003', shopId, customer: 'Shop Customer C', amount: 1985, date: '2026-09-03', invoiceNumber: 'INV-003', status: 'pending' },
    ];

    const sales = [
      { id: 'SAL-001', shopId, date: '2026-09-01', amount: 1240, customer: 'Shop Customer A', cashier: 'Cashier 1' },
      { id: 'SAL-002', shopId, date: '2026-09-02', amount: 980, customer: 'Shop Customer B', cashier: 'Cashier 1' },
      { id: 'SAL-003', shopId, date: '2026-09-03', amount: 1760, customer: 'Shop Customer C', cashier: 'Cashier 1' },
    ];

    const expenses = [
      { id: 'EXP-001', shopId, category: 'Power', amount: 420, date: '2026-09-02', description: 'Electricity bill' },
      { id: 'EXP-002', shopId, category: 'Supply', amount: 730, date: '2026-09-03', description: 'Restock purchase' },
    ];

    const accounts = [
      {
        user: {
          id: 'admin-1',
          email: 'subrahmanyam.2505@gmail.com',
          role: 'Admin',
          name: 'System Admin',
        },
        password: 'admin123',
      },
      {
        user: {
          id: '40',
          userId: '40',
          email: '40',
          role: 'Owner',
          name: 'Boss',
          shopId,
          contactNumber: '+919000000001',
          address: 'Kakinada',
        },
        password: '40',
      },
      {
        user: {
          id: '24083KKD40-OWNER',
          userId: '24083KKD40-OWNER',
          email: 'owner@vinoleger.com',
          role: 'Owner',
          name: 'Boss',
          shopId,
          contactNumber: '+919000000001',
          address: 'Kakinada',
        },
        password: '24083KKD40@Owner1',
      },
      {
        user: {
          id: '24083KKD40-CASH1',
          userId: '24083KKD40-CASH1',
          email: 'cashier@vinoleger.com',
          role: 'User',
          name: 'Cashier 1',
          shopId,
          contactNumber: '+919000000002',
          address: 'Kakinada',
        },
        password: '24083KKD40@Cashier1',
      },
    ];

    localStorage.setItem('vinoledger.registered.shops', JSON.stringify([shop]));
    localStorage.setItem('vinoledger.registered.accounts', JSON.stringify(accounts));
    localStorage.setItem('password:admin@vinoleger.com', 'admin123');
    localStorage.setItem('password:40', '40');
    localStorage.setItem('password:owner@vinoleger.com', '24083KKD40@Owner1');
    localStorage.setItem('password:cashier@vinoleger.com', '24083KKD40@Cashier1');
    localStorage.setItem('vinoledger.shop.profile', JSON.stringify(shop));
    localStorage.setItem('vinoledger.shop.list', JSON.stringify([shop]));
    localStorage.setItem('vinoledger.inventory', JSON.stringify(inventory));
    localStorage.setItem('vinoledger.invoices', JSON.stringify(invoices));
    localStorage.setItem('vinoledger.sales', JSON.stringify(sales));
    localStorage.setItem('vinoledger.expenses', JSON.stringify(expenses));
    localStorage.setItem('vinoledger.submittedDates', JSON.stringify({ [shopId]: ['2026-09-01', '2026-09-02', '2026-09-03'] }));
  }

  private seedTestData(): void {
    if (localStorage.getItem('vinoledger.shop.profile')) {
      return;
    }

    const commonShop = {
      id: 'KKD41',
      name: 'VinoLedger Test Shop',
      ownerName: 'Y Bathalaswamy',
      cashierName: 'Ramanjaneyulu',
      location: 'Kakinada',
      email: 'owner@vinoleger.com',
      phone: '+91-90000-00001',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const inventory = [
      { id: 'INV-1001', shopId: 'KKD41', productName: 'Premium Red Wine', stock: 25, unitPrice: 980, category: 'Wine' },
      { id: 'INV-1002', shopId: 'KKD41', productName: 'Vintage White Wine', stock: 18, unitPrice: 870, category: 'Wine' },
      { id: 'INV-1003', shopId: 'KKD41', productName: 'Beer Case', stock: 42, unitPrice: 520, category: 'Beer' },
      { id: 'INV-1004', shopId: 'KKD41', productName: 'Soft Drinks', stock: 64, unitPrice: 120, category: 'Beverage' },
    ];

    const invoices = [
      { id: 'INV-001', shopId: 'KKD41', customer: 'Marson House (KKD41)', amount: 1240, date: '2026-09-01', invoiceNumber: 'INV-001', status: 'paid' },
      { id: 'INV-002', shopId: 'KKD41', customer: 'City Mart (KKD41)', amount: 840, date: '2026-09-02', invoiceNumber: 'INV-002', status: 'paid' },
      { id: 'INV-003', shopId: 'KKD41', customer: 'Royal Hotel (KKD41)', amount: 1985, date: '2026-09-03', invoiceNumber: 'INV-003', status: 'pending' },
    ];

    const sales = [
      { id: 'SAL-001', shopId: 'KKD41', date: '2026-09-01', amount: 1240, customer: 'Marson House', cashier: 'Ramanjaneyulu' },
      { id: 'SAL-002', shopId: 'KKD41', date: '2026-09-02', amount: 980, customer: 'City Mart', cashier: 'Ramanjaneyulu' },
      { id: 'SAL-003', shopId: 'KKD41', date: '2026-09-03', amount: 1760, customer: 'Royal Hotel', cashier: 'Ramanjaneyulu' },
    ];

    const expenses = [
      { id: 'EXP-001', shopId: 'KKD41', category: 'Power', amount: 420, date: '2026-09-02', description: 'Electricity bill' },
      { id: 'EXP-002', shopId: 'KKD41', category: 'Supply', amount: 730, date: '2026-09-03', description: 'Restock purchase' },
    ];

    localStorage.setItem('vinoledger.shop.profile', JSON.stringify(commonShop));
    localStorage.setItem('vinoledger.shop.list', JSON.stringify([commonShop]));
    localStorage.setItem('vinoledger.inventory', JSON.stringify(inventory));
    localStorage.setItem('vinoledger.invoices', JSON.stringify(invoices));
    localStorage.setItem('vinoledger.sales', JSON.stringify(sales));
    localStorage.setItem('vinoledger.expenses', JSON.stringify(expenses));

  }

  private restoreSession() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user: User = JSON.parse(userStr);
        this.tokenSignal.set(token);
        this.currentUserSignal.set(user);
      } catch {
        this.logout();
      }
    }
  }
}
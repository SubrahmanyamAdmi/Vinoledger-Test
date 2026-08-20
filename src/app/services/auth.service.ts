import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { LoginRequest, LoginResponse, User, UserRole } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth'; // adjust to your backend

  private currentUserSignal = signal<User | null>(null);
  private tokenSignal = signal<string | null>(null);

  public currentUser = this.currentUserSignal.asReadonly();
  public token = this.tokenSignal.asReadonly();

  public isLoggedIn = computed(() => !!this.tokenSignal());
  public userRole = computed(() => this.currentUserSignal()?.role ?? null);

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, payload).pipe(
      tap((res) => {
        this.tokenSignal.set(res.token);
        this.currentUserSignal.set(res.user);
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
      }),
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
    this.router.navigate(['/login']);
  }

  hasRole(roles: UserRole | UserRole[]): boolean {
    const role = this.userRole();
    if (!role) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(role);
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
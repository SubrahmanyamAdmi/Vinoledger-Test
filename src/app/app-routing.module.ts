import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard.guard';
import { roleGuard } from './guards/role.guard.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent
      ),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'owner',
    loadComponent: () =>
      import('./features/owner/owner-dashboard/owner-dashboard.component').then(
        (m) => m.OwnerDashboardComponent
      ),
    canActivate: [authGuard, roleGuard(['Owner'])],
  },
  {
    path: 'user',
    loadComponent: () =>
      import('./features/user/user-dashboard/user-dashboard.component').then(
        (m) => m.UserDashboardComponent
      ),
    canActivate: [authGuard, roleGuard(['User'])],
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/auth/unauthorized/unauthorized.component').then(
        (m) => m.UnauthorizedComponent
      ),
  },
  { path: '**', redirectTo: '/login' },
];
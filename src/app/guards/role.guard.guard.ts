import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.waitForSession().then(() => {
      if (!auth.isLoggedIn()) {
        return router.parseUrl('/login');
      }

      if (auth.hasRole(allowedRoles)) {
        return true;
      }

      const role = auth.userRole();
      if (role === 'Admin') return router.parseUrl('/admin');
      if (role === 'Owner') return router.parseUrl('/owner');
      return router.parseUrl('/daily-sales');
    });
  };
};
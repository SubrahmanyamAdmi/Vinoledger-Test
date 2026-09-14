import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      return router.parseUrl('/login');
    }

    
    if (auth.hasRole(allowedRoles)) {
      return true;
    }

    // Authenticated but not allowed: redirect to appropriate dashboard or unauthorized page
    const role = auth.userRole();
    if (role === 'Admin') return router.parseUrl('/admin');
    if (role === 'Owner') return router.parseUrl('/owner');
    return router.parseUrl('/daily-sales');
  };
};
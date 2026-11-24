import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';


export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.waitForSession().then(() =>
    auth.isLoggedIn() ? true : router.createUrlTree(['/login'])
  );
};

// Reaching the login page (e.g. via browser back) ends any active session.
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.waitForSession().then(() => {
    if (auth.isLoggedIn()) {
      auth.logout(false);
    }
    return true;
  });
};

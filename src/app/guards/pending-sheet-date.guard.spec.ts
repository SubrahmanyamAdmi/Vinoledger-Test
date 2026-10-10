import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BusinessDataService } from '../services/business-data.service';
import { pendingSheetDateGuard } from './pending-sheet-date.guard';

describe('pendingSheetDateGuard', () => {
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.removeItem('vinoledger.submittedDates');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => ({ role: 'User', shopId: 'KKD41' }) } },
        {
          provide: BusinessDataService,
          useValue: {
            getShops: () => of([{ id: 'KKD41', openingDate: localToday() }]),
            getDaySheets: () => of([]),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('allows the cashier to enter the next pending date', async () => {
    sessionStorage.setItem('vinoledger.date', localToday());

    const result = await TestBed.runInInjectionContext(() =>
      pendingSheetDateGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBeTrue();
  });

  it('allows the next pending date from the URL when the new tab has no session date', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      pendingSheetDateGuard(
        { queryParamMap: { get: (key: string) => key === 'date' ? localToday() : null } } as any,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeTrue();
  });

  it('redirects a cashier when the stored date is not the next pending date', async () => {
    sessionStorage.setItem('vinoledger.date', '2000-01-01');

    const result = await TestBed.runInInjectionContext(() =>
      pendingSheetDateGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/sheet-date');
  });
});

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
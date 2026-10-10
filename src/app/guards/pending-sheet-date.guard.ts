import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BusinessDataService, ShopRecord } from '../services/business-data.service';

export const pendingSheetDateGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const businessData = inject(BusinessDataService);
  const user = auth.currentUser();

  if (user?.role !== 'User') {
    return true;
  }

  const shopId = String(user.shopId || '').trim();
  const selectedDate = String(route.queryParamMap?.get('date') || sessionStorage.getItem('vinoledger.date') || '');
  if (!shopId || !selectedDate) {
    return router.parseUrl('/sheet-date');
  }

  try {
    const [shops, daySheets] = await Promise.all([
      firstValueFrom(businessData.getShops()),
      firstValueFrom(businessData.getDaySheets()),
    ]);
    let sessionShop: Record<string, unknown> = {};
    try {
      sessionShop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
    } catch {
      sessionShop = {};
    }

    const shop = (shops as Array<ShopRecord & { shopId?: string; openingDate?: string; createdAt?: string }>).find((item) =>
      String(item.shopId || item.id || '').trim().toUpperCase() === shopId.toUpperCase()
    );
    const today = toLocalIsoDate(new Date());
    const cachedShopId = String(sessionShop['shopId'] || sessionShop['id'] || '').trim();
    const cachedOpeningDate = cachedShopId.toUpperCase() === shopId.toUpperCase()
      ? sessionShop['openingDate'] || sessionShop['createdAt']
      : '';
    const storedOpeningDate = String(shop?.openingDate || shop?.createdAt || cachedOpeningDate || '').slice(0, 10);
    const openingDate = /^\d{4}-\d{2}-\d{2}$/.test(storedOpeningDate) && storedOpeningDate <= today
      ? storedOpeningDate
      : today;
    const submittedDates = new Set<string>([
      ...daySheets
        .filter((sheet) => String(sheet.shopId || '').trim().toUpperCase() === shopId.toUpperCase())
        .map((sheet) => String(sheet.date || '').slice(0, 10)),
      ...readLocallySubmittedDates(shopId),
    ]);
    const nextDate = nextPendingDate(openingDate, today, submittedDates);

    return selectedDate === nextDate
      ? true
      : router.parseUrl('/sheet-date');
  } catch {
    return router.parseUrl('/sheet-date');
  }
};

function nextPendingDate(openingDate: string, today: string, submittedDates: Set<string>): string {
  const current = new Date(`${openingDate}T00:00:00`);
  const end = new Date(`${today}T00:00:00`);
  for (; current <= end; current.setDate(current.getDate() + 1)) {
    const date = toLocalIsoDate(current);
    if (!submittedDates.has(date)) {
      return date;
    }
  }
  return '';
}

function readLocallySubmittedDates(shopId: string): string[] {
  try {
    const allSubmitted = JSON.parse(localStorage.getItem('vinoledger.submittedDates') || '{}');
    const key = Object.keys(allSubmitted).find((candidate) => candidate.toUpperCase() === shopId.toUpperCase());
    const dates = key ? allSubmitted[key] : [];
    return Array.isArray(dates) ? dates.map((date: string) => String(date).slice(0, 10)) : [];
  } catch {
    return [];
  }
}

function toLocalIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
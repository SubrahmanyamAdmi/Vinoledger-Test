import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { AppIconName } from './shared/icon/icon.component';

type RoleName = 'Owner' | 'User' | 'Admin';

interface MobileNavItem {
  label: string;
  shortLabel: string;
  icon: AppIconName;
  route: string;
  roles?: RoleName[];
}

const NAV_ITEMS: MobileNavItem[] = [
  { label: 'Owner Dashboard', shortLabel: 'Home', icon: 'home', route: '/owner', roles: ['Owner'] },
  { label: 'Daily Sales', shortLabel: 'Sales', icon: 'chart', route: '/owner-daily-sales', roles: ['Owner'] },
  { label: 'Invoices', shortLabel: 'Invoices', icon: 'receipt', route: '/owner/invoices', roles: ['Owner'] },
  { label: 'Manage Partners', shortLabel: 'Partners', icon: 'partners', route: '/manage-partners', roles: ['Owner'] },
  { label: 'Stock', shortLabel: 'Stock', icon: 'bottle', route: '/stock', roles: ['Owner'] },
  { label: 'Generate Invoice', shortLabel: 'Invoice', icon: 'receipt', route: '/generate-invoice', roles: ['Owner'] },
  { label: 'Reports', shortLabel: 'Reports', icon: 'chart', route: '/reports', roles: ['Owner', 'Admin'] },
  { label: 'Profile', shortLabel: 'Profile', icon: 'person', route: '/profile', roles: ['Owner', 'User', 'Admin'] },

  { label: 'Admin Dashboard', shortLabel: 'Home', icon: 'home', route: '/admin', roles: ['Admin'] },
  { label: 'Customers & Shops', shortLabel: 'Shops', icon: 'store', route: '/admin/customers', roles: ['Admin'] },
  { label: 'User Management', shortLabel: 'Users', icon: 'person', route: '/admin/users', roles: ['Admin'] },
  { label: 'Register Owner', shortLabel: 'Register', icon: 'partners', route: '/admin/register-owner', roles: ['Admin'] },
  { label: 'Day Sheet Review', shortLabel: 'Day Sheets', icon: 'file', route: '/admin/day-sheet-view', roles: ['Admin'] },
  { label: 'Admin Invoices', shortLabel: 'Invoices', icon: 'receipt', route: '/admin/invoices', roles: ['Admin'] },
  { label: 'Business Flow', shortLabel: 'Flow', icon: 'chart', route: '/admin/business-flow', roles: ['Admin'] },
  { label: 'Update MRP', shortLabel: 'MRP', icon: 'cash', route: '/admin/update-mrp', roles: ['Admin'] },
  { label: 'Day Sheet Entry', shortLabel: 'Entry', icon: 'calendar', route: '/admin/day-sheet-entry', roles: ['Admin'] },
  { label: 'Shop Management', shortLabel: 'Management', icon: 'settings', route: '/management', roles: ['Admin'] },
  { label: 'Contact Admin', shortLabel: 'Help', icon: 'support', route: '/contact-admin', roles: ['Owner', 'Admin'] },
];

const USER_NAV_ITEMS: MobileNavItem[] = [
  { label: 'Cashier Home', shortLabel: 'Home', icon: 'home', route: '/cashier-home', roles: ['User'] },
  { label: 'Day Sheet', shortLabel: 'Day Sheet', icon: 'file', route: '/sheet-date', roles: ['User'] },
  { label: 'Manage Partners Transactions', shortLabel: 'Partners', icon: 'partners', route: '/manage-partners', roles: ['User'] },
  { label: 'Stock', shortLabel: 'Stock', icon: 'bottle', route: '/stock', roles: ['User'] },
  { label: 'Profile', shortLabel: 'Profile', icon: 'person', route: '/profile', roles: ['User'] },
];

const getNavItemsForRole = (role: string | undefined): MobileNavItem[] => {
  if (!role) {
    return [];
  }

  if (role === 'User') {
    return USER_NAV_ITEMS;
  }

  return NAV_ITEMS.filter((item) => item.roles?.includes(role as RoleName));
};

const ADMIN_NAV_ITEMS: MobileNavItem[] = getNavItemsForRole('Admin');
const OWNER_NAV_ITEMS: MobileNavItem[] = getNavItemsForRole('Owner');
const ADMIN_SIDEBAR_ITEMS: MobileNavItem[] = ADMIN_NAV_ITEMS;
const DESKTOP_SIDEBAR_ITEMS_BY_ROLE: Record<string, MobileNavItem[]> = {
  Owner: OWNER_NAV_ITEMS,
  User: USER_NAV_ITEMS,
  Admin: ADMIN_SIDEBAR_ITEMS,
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'vinoledger';

  constructor(public auth: AuthService, private router: Router) {}

  get mobileNavItems(): MobileNavItem[] {
    const role = this.auth.currentUser()?.role;
    const items = getNavItemsForRole(role);
    return role === 'Owner'
      ? items.filter((item) => item.route !== '/reports' && item.route !== '/profile')
      : items;
  }

  get adminSidebarItems(): MobileNavItem[] {
    return getNavItemsForRole('Admin');
  }

  get desktopSidebarItems(): MobileNavItem[] {
    return getNavItemsForRole(this.auth.currentUser()?.role);
  }

  get showAdminSidebar(): boolean {
    return this.auth.isLoggedIn() && !this.isStandaloneDaySheet && this.auth.currentUser()?.role === 'Admin' && this.router.url !== '/login';
  }

  get showDesktopSidebar(): boolean {
    const route = this.router.url.split(/[?#]/, 1)[0];
    return this.auth.isLoggedIn() && !this.isStandaloneDaySheet && route !== '/login' && this.desktopSidebarItems.length > 0;
  }

  get showMobileNavigation(): boolean {
    const route = this.router.url.split(/[?#]/, 1)[0];
    return this.auth.isLoggedIn() && !this.isStandaloneDaySheet && route !== '/login' && this.mobileNavItems.length > 0;
  }

  get showAppHeader(): boolean {
    const route = this.router.url.split(/[?#]/, 1)[0];
    return this.auth.isLoggedIn() && !this.isStandaloneDaySheet && route !== '/login';
  }

  get isStandaloneDaySheet(): boolean {
    return this.router.url.startsWith('/day-sheet?view=standalone') || this.router.url.includes('&view=standalone');
  }

  isActive(route: string): boolean {
    const currentRoute = this.router.url.split(/[?#]/, 1)[0];
    if (currentRoute === '/day-sheet') {
      const role = this.auth.currentUser()?.role;
      return role === 'Admin'
        ? route === '/admin/day-sheet-entry'
        : role === 'User' && route === '/sheet-date';
    }
    if (route === '/admin' || route === '/owner') {
      return currentRoute === route;
    }
    return currentRoute === route || currentRoute.startsWith(`${route}/`);
  }

  navigateTo(route: string) {
    this.router.navigateByUrl(route);
  }
}

import { RouterModule, Routes } from '@angular/router';
import { authGuard, loginGuard } from './guards/auth.guard.guard';
import { roleGuard } from './guards/role.guard.guard';
import { pendingSheetDateGuard } from './guards/pending-sheet-date.guard';
import { NgModule } from '@angular/core';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'cashier-home',
    loadComponent: () => import('./pages/cashier-home/cashier-home.component').then((m) => m.CashierHomeComponent),
    canActivate: [authGuard, roleGuard(['User'])],
  },
  {
    path: 'sheet-date',
    loadComponent: () => import('./pages/sheet-date/sheet-date.component').then((m) => m.SheetDateComponent),
    canActivate: [authGuard, roleGuard(['User', 'Admin'])],
  },
  {
    path: 'invoice',
    loadComponent: () => import('./pages/invoice-entry/invoice-entry.component').then((m) => m.InvoiceEntryComponent),
    canActivate: [authGuard, roleGuard(['User', 'Admin']), pendingSheetDateGuard],
  },
  {
    path: 'opening-stock',
    loadComponent: () => import('./pages/opening-stock/opening-stock.component').then((m) => m.OpeningStockComponent),
    canActivate: [authGuard, roleGuard(['User', 'Admin'])],
  },
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'admin/register-owner',
    loadComponent: () => import('./pages/admin-dashboard/admin-register-owner.component').then((m) => m.AdminRegisterOwnerComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'admin/customers',
    loadComponent: () => import('./pages/admin-dashboard/admin-customers.component').then((m) => m.AdminCustomersComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'admin/day-sheet-view',
    loadComponent: () => import('./pages/admin-dashboard/admin-day-sheet-view.component').then((m) => m.AdminDaySheetViewComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'admin/invoices',
    loadComponent: () => import('./pages/admin-dashboard/admin-invoices.component').then((m) => m.AdminInvoicesComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'admin/business-flow',
    loadComponent: () => import('./pages/admin-dashboard/admin-business-flow.component').then((m) => m.AdminBusinessFlowComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'admin/update-mrp',
    loadComponent: () => import('./pages/admin-dashboard/admin-update-mrp.component').then((m) => m.AdminUpdateMrpComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'admin/day-sheet-entry',
    loadComponent: () => import('./pages/admin-dashboard/admin-day-sheet-entry.component').then((m) => m.AdminDaySheetEntryComponent),
    canActivate: [authGuard, roleGuard(['Admin'])],
  },
  {
    path: 'owner',
    loadComponent: () => import('./pages/owner-dashboard/owner-dashboard.component').then((m) => m.OwnerDashboardComponent),
    canActivate: [authGuard, roleGuard(['Owner'])],
  },
  {
    path: 'owner-daily-sales',
    loadComponent: () => import('./pages/owner-daily-sales/owner-daily-sales.component').then((m) => m.OwnerDailySalesComponent),
    canActivate: [authGuard, roleGuard(['Owner'])],
  },
  {
    path: 'owner/invoices',
    loadComponent: () => import('./pages/owner-invoices/owner-invoices.component').then((m) => m.OwnerInvoicesComponent),
    canActivate: [authGuard, roleGuard(['Owner'])],
  },
  {
    path: 'manage-partners/:id',
    loadComponent: () => import('./pages/manage-partners/manage-partners.component').then((m) => m.ManagePartnersComponent),
    canActivate: [authGuard, roleGuard(['Owner', 'User'])],
  },
  {
    path: 'manage-partners',
    loadComponent: () => import('./pages/manage-partners/manage-partners.component').then((m) => m.ManagePartnersComponent),
    canActivate: [authGuard, roleGuard(['Owner', 'User'])],
  },
  {
    path: 'stock',
    loadComponent: () => import('./pages/stock/stock.component').then((m) => m.StockComponent),
    canActivate: [authGuard, roleGuard(['Owner', 'User'])],
  },
  {
    path: 'generate-invoice',
    loadComponent: () => import('./pages/generate-invoice/generate-invoice.component').then((m) => m.GenerateInvoiceComponent),
    canActivate: [authGuard, roleGuard(['Owner'])],
  },
  {
    path: 'mrp-check',
    loadComponent: () => import('./pages/admin-dashboard/admin-update-mrp.component').then((m) => m.AdminUpdateMrpComponent),
    canActivate: [authGuard, roleGuard(['Owner', 'Admin'])],
  },
  {
    path: 'contact-admin',
    loadComponent: () => import('./pages/contact-admin/contact-admin.component').then((m) => m.ContactAdminComponent),
    canActivate: [authGuard],
  },
  { path: 'user', redirectTo: '/daily-sales', pathMatch: 'full' },
  {
    path: 'daily-sales',
    redirectTo: '/day-sheet',
    pathMatch: 'full',
  },
  {
    path: 'day-sheet',
    loadComponent: () => import('./pages/day-sheet/day-sheet.component').then((m) => m.DaySheetComponent),
    canActivate: [authGuard, roleGuard(['User', 'Admin']), pendingSheetDateGuard],
  },
  {
    path: 'inventory',
    loadComponent: () => import('./pages/inventory-management/inventory-management.component').then((m) => m.InventoryManagementComponent),
    canActivate: [authGuard]
  },
  {
    path: 'expenses',
    loadComponent: () => import('./pages/expense-tracker/expense-tracker.component').then((m) => m.ExpenseTrackerComponent),
    canActivate: [authGuard]
  },
  {
    path: 'accounting',
    loadComponent: () => import('./pages/accounting-ledger/accounting-ledger.component').then((m) => m.AccountingLedgerComponent),
    canActivate: [authGuard, roleGuard(['Owner'])]
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports-center/reports-center.component').then((m) => m.ReportsCenterComponent),
    canActivate: [authGuard]
  },
  {
    path: 'management',
    loadComponent: () => import('./pages/user-shop-management/user-shop-management.component').then((m) => m.UserShopManagementComponent),
    canActivate: [authGuard, roleGuard(['Admin'])]
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile-settings/profile-settings.component').then((m) => m.ProfileSettingsComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}

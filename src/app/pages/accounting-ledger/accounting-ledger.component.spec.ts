import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AuthService } from '../../services/auth.service';
import { PartnerDataService } from '../../services/partner-data.service';
import { BusinessDataService } from '../../services/business-data.service';
import { of } from 'rxjs';
import { AccountingLedgerComponent } from './accounting-ledger.component';

describe('AccountingLedgerComponent', () => {
  const data = {
    partners: [
      { id: 'P1', name: 'A', mobile: '', joiningDate: '2026-01-01', investmentAmount: 500000, profitShare: 60, status: 'Active' as const },
      { id: 'P2', name: 'B', mobile: '', joiningDate: '2026-01-01', investmentAmount: 300000, profitShare: 40, status: 'Active' as const },
    ],
    partnerTransactions: [
      { id: 'T1', partnerName: 'A', transactionType: 'Stock Taken' as const, product: 'Rum', amount: 1000, paymentStatus: 'Pending' as const, createdAt: '2026-10-05T10:00:00' },
      { id: 'T2', partnerName: 'A', transactionType: 'Cash' as const, product: '', amount: 500, paymentStatus: 'Pending' as const, createdAt: '2026-09-05T10:00:00' },
      { id: 'T3', partnerName: 'B', transactionType: 'Cash' as const, product: '', amount: 2000, paymentStatus: 'Pending' as const, createdAt: '2026-10-06T10:00:00' },
    ],
    profitDistributions: [
      { id: 'D1', amount: 100000, createdAt: '2026-10-07T10:00:00', shares: [] },
      { id: 'D2', amount: 50000, createdAt: '2026-08-07T10:00:00', shares: [] },
    ],
  };

  const daySheets = [
    { shopId: 'S1', date: '2026-10-02', totalDaySale: 10000, totalExpenses: 5200, presentCashValue: 40000, records: [{ sizes: [{ closing: 4, price: 250 }] }], additionalProfitRows: [{ name: 'Brand Discounts', value: 700, comment: '' }], expenses: [{ name: 'Shop Rent', value: 5000, comment: 'Oct rent' }, { name: 'Tea', value: 200 }] },
    { shopId: 'S1', date: '2026-10-09', totalDaySale: 8000, totalExpenses: 3000, presentCashValue: 45000, records: [{ sizes: [{ closing: 10, price: 100 }] }], expenses: [{ name: 'Salary', value: 3000 }] },
    { shopId: 'S1', date: '2026-09-09', expenses: [{ name: 'Salary', value: 9999 }] },
    { shopId: 'OTHER', date: '2026-10-09', expenses: [{ name: 'Salary', value: 7777 }] },
  ];
  const invoices = [
    { shopId: 'S1', date: '2026-10-02', amount: 20000 },
    { shopId: 'OTHER', date: '2026-10-02', amount: 99999 },
  ];

  function create() {
    TestBed.configureTestingModule({
      imports: [AccountingLedgerComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: { currentUser: () => ({ role: 'Owner', shopId: 'S1' }) } },
        { provide: PartnerDataService, useValue: { load: () => Promise.resolve(data) } },
        { provide: BusinessDataService, useValue: { getDaySheets: () => of(daySheets), getInvoices: () => of(invoices) } },
      ],
    });
    const fixture = TestBed.createComponent(AccountingLedgerComponent);
    const component = fixture.componentInstance;
    component.fromDate = '2026-10-01';
    component.toDate = '2026-10-31';
    return { fixture, component };
  }

  it('totals investments and shares', async () => {
    const { fixture, component } = create();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.totalInvestment).toBe(800000);
    expect(component.totalProfitShare).toBe(100);
  });

  it('filters transactions and distributions by date range but keeps pending till date', async () => {
    const { fixture, component } = create();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.transactionsInRange.map((t) => t.id)).toEqual(['T1', 'T3']);
    expect(component.distributionsTotal).toBe(100000);
    const rowA = component.partnerSummary[0];
    expect(rowA.stockTaken).toBe(1000);
    expect(rowA.cashTaken).toBe(0);
    expect(rowA.pending).toBe(1500);
    expect(component.summaryTotals.pending).toBe(3500);
  });

  it('totals this shop\'s expenses in range and groups them by category', async () => {
    const { fixture, component } = create();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.expensesTotal).toBe(8200);
    expect(component.expenseCategories.map((c) => [c.category, c.amount])).toEqual([['Rent', 5000], ['Employee', 3000], ['Miscellaneous', 200]]);
  });

  it('shows stock, cash, additional profit and daily rows for this shop only', async () => {
    const { fixture, component } = create();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.stockCash).toEqual({ asOf: '2026-10-09', stockValue: 1000, cashValue: 45000 });
    expect(component.companyWorth).toBe(46000);
    expect(component.benefitsTotal).toBe(700);
    expect(component.dailyRowsInRange).toEqual([
      { date: '2026-10-02', sale: 10000, purchase: 20000, expenses: 5200 },
      { date: '2026-10-09', sale: 8000, purchase: 0, expenses: 3000 },
    ]);
    expect(component.dailyTotals).toEqual({ sale: 18000, purchase: 20000, expenses: 8200 });
  });

  it('flags an inverted date range', async () => {
    const { fixture, component } = create();
    fixture.detectChanges();
    await fixture.whenStable();
    component.fromDate = '2026-11-01';
    expect(component.invalidRange).toBeTrue();
  });
});

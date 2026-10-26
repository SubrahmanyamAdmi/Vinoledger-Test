import { benefitEntries, dailyRows, filterByShop, stockCashSnapshot, stockValueOf } from './accounting-figures';

describe('accounting-figures', () => {
  const sheet = (date: string, extra: any = {}) => ({
    shopId: 'S1',
    date,
    records: [{ sizes: [{ closing: 10, price: 100 }, { closing: 2, price: 500 }] }],
    totalDaySale: 1000,
    totalExpenses: 100,
    grandTotal: 900,
    ...extra,
  });

  it('values stock as closing quantity times price', () => {
    expect(stockValueOf(sheet('2026-10-01'))).toBe(2000);
  });

  it('uses the latest sheet on or before the date for stock and cash', () => {
    const sheets = [
      sheet('2026-10-01', { presentCashValue: 5000 }),
      sheet('2026-10-10', { presentCashValue: 8000, records: [{ sizes: [{ closing: 1, price: 300 }] }] }),
      sheet('2026-10-20', { presentCashValue: 99999 }),
    ];
    expect(stockCashSnapshot(sheets, [], '2026-10-15')).toEqual({ asOf: '2026-10-10', stockValue: 300, cashValue: 8000 });
    expect(stockCashSnapshot(sheets, [], '2026-09-01')).toBeNull();
  });

  it('keeps a stored cash value of zero and falls back to sheets minus invoices when missing', () => {
    expect(stockCashSnapshot([sheet('2026-10-01', { presentCashValue: 0 })], [], '2026-10-31')?.cashValue).toBe(0);
    const fallback = stockCashSnapshot([sheet('2026-10-01'), sheet('2026-10-02')], [{ date: '2026-10-01', amount: 500 }], '2026-10-31');
    expect(fallback?.cashValue).toBe(1300);
  });

  it('collects positive additional profit rows', () => {
    const entries = benefitEntries([sheet('2026-10-01', { additionalProfitRows: [{ name: 'Empty Bottles', value: 200, comment: 'x' }, { name: 'Other Benefits', value: 0 }] })]);
    expect(entries).toEqual([{ date: '2026-10-01', name: 'Empty Bottles', comment: 'x', amount: 200 }]);
  });

  it('builds date-wise sale, purchase and expenses, including purchase-only days', () => {
    const rows = dailyRows(
      [sheet('2026-10-02'), sheet('2026-10-01', { totalDaySale: 500, totalExpenses: 50 })],
      [{ date: '2026-10-02T09:00:00', amount: 300 }, { date: '2026-10-03', amount: 700 }]
    );
    expect(rows).toEqual([
      { date: '2026-10-01', sale: 500, purchase: 0, expenses: 50 },
      { date: '2026-10-02', sale: 1000, purchase: 300, expenses: 100 },
      { date: '2026-10-03', sale: 0, purchase: 700, expenses: 0 },
    ]);
  });

  it('filters records by shop id case-insensitively', () => {
    expect(filterByShop([{ shopId: 's1' }, { shopId: 'S2' }, { shop: { id: 'S1' } }], 'S1').length).toBe(2);
  });
});

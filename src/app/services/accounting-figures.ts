export interface DailyRow {
  date: string;
  sale: number;
  purchase: number;
  expenses: number;
}

export interface BenefitEntry {
  date: string;
  name: string;
  comment: string;
  amount: number;
}

export interface StockCashSnapshot {
  asOf: string;
  stockValue: number;
  cashValue: number;
}

const sameShop = (item: any, shopId: string) =>
  String(item?.shopId || item?.shop?.id || '').toUpperCase() === String(shopId || '').toUpperCase();

const day = (value: unknown) => String(value || '').slice(0, 10);

export function filterByShop<T>(items: T[], shopId: string): T[] {
  return (Array.isArray(items) ? items : []).filter((item) => sameShop(item, shopId));
}

export function stockValueOf(sheet: any): number {
  return (sheet?.records || []).reduce((sum: number, record: any) =>
    sum + (record.sizes || []).reduce((sizeSum: number, size: any) =>
      sizeSum + Number(size.closing || 0) * Number(size.price || 0), 0), 0);
}

// Stock and cash as recorded by the latest submitted day sheet on or before `upTo`.
export function stockCashSnapshot(sheets: any[], invoices: any[], upTo: string): StockCashSnapshot | null {
  const upToDay = day(upTo);
  const eligible = sheets
    .filter((sheet) => day(sheet.date) && (!upToDay || day(sheet.date) <= upToDay))
    .sort((a, b) => day(b.date).localeCompare(day(a.date)));
  const latest = eligible[0];
  if (!latest) {
    return null;
  }
  const stored = latest.presentCashValue;
  const hasStored = stored !== null && stored !== undefined && stored !== '' && Number.isFinite(Number(stored));
  const cashValue = hasStored
    ? Number(stored)
    : eligible.reduce((sum, sheet) => sum + Number(sheet.grandTotal || 0), 0)
      - invoices.filter((invoice) => !upToDay || day(invoice.date) <= upToDay).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  return { asOf: day(latest.date), stockValue: stockValueOf(latest), cashValue };
}

export function benefitEntries(sheets: any[]): BenefitEntry[] {
  return sheets.flatMap((sheet) => (Array.isArray(sheet.additionalProfitRows) ? sheet.additionalProfitRows : []).map((row: any) => ({
    date: day(sheet.date),
    name: String(row.name || 'Other').trim() || 'Other',
    comment: String(row.comment || '').trim(),
    amount: Math.max(0, Number(row.value || 0)),
  }))).filter((entry) => entry.date && entry.amount > 0);
}

export function dailyRows(sheets: any[], invoices: any[]): DailyRow[] {
  const byDate = new Map<string, DailyRow>();
  const row = (date: string) => {
    if (!byDate.has(date)) {
      byDate.set(date, { date, sale: 0, purchase: 0, expenses: 0 });
    }
    return byDate.get(date)!;
  };
  sheets.forEach((sheet) => {
    const date = day(sheet.date);
    if (date) {
      const entry = row(date);
      entry.sale += Number(sheet.totalDaySale || 0);
      entry.expenses += Number(sheet.totalExpenses || 0);
    }
  });
  invoices.forEach((invoice) => {
    const date = day(invoice.date);
    if (date) {
      row(date).purchase += Number(invoice.amount || 0);
    }
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

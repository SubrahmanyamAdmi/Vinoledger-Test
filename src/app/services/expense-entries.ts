export interface ExpenseEntry {
  date: string;
  category: string;
  description: string;
  amount: number;
}

export function expenseCategoryFor(name: string): string {
  const value = String(name || '').toLowerCase();
  if (value.includes('salary') || value.includes('employee')) return 'Employee';
  if (value.includes('rent')) return 'Rent';
  if (value.includes('current') || value.includes('electric')) return 'Electricity';
  if (value.includes('department') || value.includes('license') || value.includes('government')) return 'Government/License';
  if (value.includes('transport')) return 'Transport';
  if (value.includes('repair') || value.includes('maintenance')) return 'Maintenance';
  return value === 'shop' ? 'Shop' : 'Miscellaneous';
}

// Expenses are recorded inside each submitted day sheet; this flattens them for one shop.
export function flattenDaySheetExpenses(sheets: any[], shopId: string): ExpenseEntry[] {
  const shopKey = String(shopId || '').toUpperCase();
  return (Array.isArray(sheets) ? sheets : [])
    .filter((sheet) => String(sheet.shopId || sheet.shop?.id || '').toUpperCase() === shopKey)
    .flatMap((sheet) => (Array.isArray(sheet.expenses) ? sheet.expenses : []).map((expense: any) => ({
      date: String(sheet.date || '').slice(0, 10),
      category: expenseCategoryFor(expense.name),
      description: String(expense.comment || expense.description || '').trim() || 'No description',
      amount: Math.max(0, Number(expense.value || expense.amount || 0))
    })))
    .filter((entry) => entry.amount > 0 && entry.date);
}

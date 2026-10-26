import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { SidenavComponent } from '../../shared/sidenav/sidenav.component';
import { BusinessDataService } from '../../services/business-data.service';
import { AuthService } from '../../services/auth.service';
import { AppSelectComponent, AppSelectOption } from '../../shared/select/select.component';
import { ExpenseEntry, flattenDaySheetExpenses } from '../../services/expense-entries';

interface CategoryTotal {
  category: string;
  amount: number;
  percentage: number;
}

@Component({
  selector: 'app-expense-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, TopbarComponent, SidenavComponent, AppSelectComponent],
  templateUrl: './expense-tracker.component.html',
  styleUrls: ['./expense-tracker.component.scss']
})
export class ExpenseTrackerComponent implements OnInit {
  shopId = '';
  shopName = 'Assigned Shop';
  selectedMonth = this.monthKey(new Date());
  monthOptions: string[] = [];
  entries: ExpenseEntry[] = [];
  categoryTotals: CategoryTotal[] = [];
  dailyEntries: ExpenseEntry[] = [];
  comparison: Array<{ category: string; current: number; previous: number }> = [];
  totalExpenses = 0;
  dailyAverage = 0;
  highestDaily = 0;

  get monthSelectOptions(): AppSelectOption[] {
    return this.monthOptions.map((month) => ({ value: month, label: this.monthLabel(month) }));
  }

  get previousYearLabel() {
    return `${Number(this.selectedMonth.slice(0, 4)) - 1} ${this.monthLabel(this.selectedMonth).split(' ')[0]}`;
  }

  get previousTotal() {
    return this.comparison.reduce((total, item) => total + item.previous, 0);
  }

  constructor(public auth: AuthService, private data: BusinessDataService) {}

  ngOnInit(): void {
    const user = this.auth.currentUser();
    this.shopId = user?.shopId || this.readSessionShop().id || '';
    this.shopName = this.readSessionShop().name || this.shopId || 'Assigned Shop';
    this.monthOptions = Array.from({ length: 12 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      return this.monthKey(date);
    });
    this.data.getDaySheets().subscribe((sheets) => {
      this.entries = this.flattenExpenses(sheets);
      this.refreshReport();
    });
  }

  refreshReport() {
    const current = this.entries.filter((entry) => entry.date.startsWith(this.selectedMonth));
    this.totalExpenses = this.sum(current);
    const daysInMonth = new Date(Number(this.selectedMonth.slice(0, 4)), Number(this.selectedMonth.slice(5, 7)), 0).getDate();
    this.dailyAverage = daysInMonth ? this.totalExpenses / daysInMonth : 0;
    const byDay = new Map<string, number>();
    current.forEach((entry) => byDay.set(entry.date, (byDay.get(entry.date) || 0) + entry.amount));
    this.highestDaily = Math.max(0, ...byDay.values());
    const byCategory = new Map<string, number>();
    current.forEach((entry) => byCategory.set(entry.category, (byCategory.get(entry.category) || 0) + entry.amount));
    this.categoryTotals = [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount, percentage: this.totalExpenses ? amount / this.totalExpenses * 100 : 0 }))
      .sort((first, second) => second.amount - first.amount);
    this.dailyEntries = [...current].sort((first, second) => second.date.localeCompare(first.date));

    const previousMonth = `${Number(this.selectedMonth.slice(0, 4)) - 1}-${this.selectedMonth.slice(5)}`;
    const previousEntries = this.entries.filter((entry) => entry.date.startsWith(previousMonth));
    const categories = new Set([...this.categoryTotals.map((item) => item.category), ...previousEntries.map((item) => item.category)]);
    this.comparison = [...categories].map((category) => ({
      category,
      current: this.sum(current.filter((entry) => entry.category === category)),
      previous: this.sum(previousEntries.filter((entry) => entry.category === category))
    })).sort((first, second) => (second.current + second.previous) - (first.current + first.previous));
  }

  monthLabel(value: string) {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T00:00:00`));
  }

  formatCurrency(value: number) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  categoryWidth(amount: number) {
    return `${this.totalExpenses ? Math.max(4, amount / this.totalExpenses * 100) : 0}%`;
  }

  private flattenExpenses(sheets: any[]): ExpenseEntry[] {
    return flattenDaySheetExpenses(sheets, this.shopId);
  }

  private sum(entries: ExpenseEntry[]) {
    return entries.reduce((total, entry) => total + entry.amount, 0);
  }

  private monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private readSessionShop(): { id?: string; name?: string } {
    try { return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}'); } catch { return {}; }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { SidenavComponent } from '../../shared/sidenav/sidenav.component';
import { MockDataService } from '../../shared/services/mock-data.service';

@Component({
  selector: 'app-expense-tracker',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, TopbarComponent, SidenavComponent],
  templateUrl: './expense-tracker.component.html',
  styleUrls: ['./expense-tracker.component.scss']
})
export class ExpenseTrackerComponent implements OnInit {
  expenses: any[] = [];
  constructor(private data: MockDataService) {}
  ngOnInit(): void {
    this.data.getExpenses().subscribe((r: any) => (this.expenses = r || []));
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { SidenavComponent } from '../../shared/sidenav/sidenav.component';

@Component({
  selector: 'app-accounting-ledger',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, TopbarComponent, SidenavComponent],
  templateUrl: './accounting-ledger.component.html',
  styleUrls: ['./accounting-ledger.component.scss']
})
export class AccountingLedgerComponent {}

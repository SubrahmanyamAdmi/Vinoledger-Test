import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-accounting-ledger',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accounting-ledger.component.html',
  styleUrls: ['./accounting-ledger.component.scss']
})
export class AccountingLedgerComponent {
  constructor(public auth: AuthService) {}
}

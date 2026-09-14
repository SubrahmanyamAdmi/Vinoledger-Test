import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
export interface StockRow {
  no: number;
  particulars: string;
  opening: { q: number | null; p: number | null; n: number | null; d: number | null };
  receipts: { q: number | null; p: number | null; n: number | null; d: number | null };
  total: { q: number | null; p: number | null; n: number | null; d: number | null };
  sales: { q: number | null; p: number | null; n: number | null; d: number | null };
  balance: { q: number | null; p: number | null; n: number | null; d: number | null };
  rate: { q: number | null; p: number | null; n: number | null; d: number | null };
  amount: { rs: number | null; ps: number | null };
}

@Component({
  selector: 'app-genrate-day-sheet',
  standalone: true,
  imports: [CommonModule, MatTableModule],
  templateUrl: './genrate-day-sheet.component.html',
  styleUrls: ['./genrate-day-sheet.component.scss']
})
export class GenrateDaySheetComponent {
  // Top-level header row layout
  displayedHeaderRows1 = [
    'no', 'particulars', 
    'openingGroup', 'receiptsGroup', 'totalGroup', 
    'salesGroup', 'balanceGroup', 'rateGroup', 'amountGroup'
  ];

  // Detailed column definitions for the second header row & data rows
  displayedColumns = [
    'no', 'particulars',
    'op_q', 'op_p', 'op_n', 'op_d',
    'rec_q', 'rec_p', 'rec_n', 'rec_d',
    'tot_q', 'tot_p', 'tot_n', 'tot_d',
    'sal_q', 'sal_p', 'sal_n', 'sal_d',
    'bal_q', 'bal_p', 'bal_n', 'bal_d',
    'rate_q', 'rate_p', 'rate_n', 'rate_d',
    'amt_rs', 'amt_ps'
  ];

  // Data populated from image sample
  dataSource: StockRow[] = [
    {
      no: 5, particulars: 'Vat 69',
      opening: { q: null, p: null, n: null, d: null },
      receipts: { q: null, p: null, n: null, d: null },
      total: { q: null, p: null, n: null, d: null },
      sales: { q: 1, p: null, n: null, d: null },
      balance: { q: 3, p: null, n: 13, d: null },
      rate: { q: 2510, p: null, n: null, d: null },
      amount: { rs: 2510, ps: null }
    },
    {
      no: 6, particulars: '100 Pipers',
      opening: { q: 4, p: null, n: 13, d: null },
      receipts: { q: null, p: null, n: null, d: null },
      total: { q: null, p: null, n: null, d: null },
      sales: { q: null, p: null, n: null, d: null },
      balance: { q: null, p: null, n: null, d: null },
      rate: { q: null, p: null, n: null, d: null },
      amount: { rs: null, ps: null }
    },
    {
      no: 12, particulars: 'Blenders Pride',
      opening: { q: 11, p: 8, n: 28, d: null },
      receipts: { q: null, p: null, n: null, d: null },
      total: { q: null, p: null, n: null, d: null },
      sales: { q: 3, p: 1, n: 2, d: null },
      balance: { q: 8, p: 7, n: 26, d: null },
      rate: { q: 1000, p: 710, n: 360, d: null },
      amount: { rs: 5670, ps: null }
    },
    {
      no: 15, particulars: 'Royal Challenge',
      opening: { q: 18, p: 11, n: 111, d: null },
      receipts: { q: 24, p: 48, n: null, d: null },
      total: { q: 9, p: 33, n: 67, d: null },
      sales: { q: 17, p: 3, n: 24, d: null },
      balance: { q: 1, p: 8, n: 87, d: null },
      rate: { q: 920, p: 460, n: 210, d: null },
      amount: { rs: 22060, ps: null }
    }
  ];
}
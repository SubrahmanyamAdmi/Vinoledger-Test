import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AdminDaySheetViewComponent } from './admin-day-sheet-view.component';

describe('AdminDaySheetViewComponent', () => {
  let component: AdminDaySheetViewComponent;
  let fixture: ComponentFixture<AdminDaySheetViewComponent>;

  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AdminDaySheetViewComponent, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDaySheetViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the cashier-submitted day sheet for the selected shop and date', () => {
    const submission = {
      shop: { id: 'MH2041', name: 'Marson House', owner: 'Suresh Varma' },
      date: '2026-09-06',
      records: [
        {
          brand: 'Royal Stag',
          code: 'RS-01',
          sizes: [
            { size: '1000ml', opening: 10, closing: 12, price: 950, amount: 11400 },
            { size: '750ml', opening: 8, closing: 9, price: 720, amount: 6480 }
          ],
          difference: 0,
          remarks: 'ok'
        }
      ],
      expenses: [{ name: 'Rent', value: 2000, comment: 'Monthly rent' }],
      additionalProfit: 1500,
      totalDaySale: 17880,
      totalExpenses: 2000,
      grandTotal: 16380,
      submittedAt: '2026-09-06T10:00:00.000Z'
    };

    sessionStorage.setItem('vinoledger.daySheetSubmission', JSON.stringify(submission));
    component.selectedShopId = 'MH2041';
    component.selectedDate = '2026-09-06';

    component.viewDaySheet();

    expect(component.sheetFound).toBeTrue();
    expect(component.daySheetData.shop.id).toBe('MH2041');
    expect(component.daySheetData.date).toBe('2026-09-06');
    expect(component.daySheetData.records.length).toBe(1);
  });
});

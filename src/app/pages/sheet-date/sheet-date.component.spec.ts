import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { SheetDateComponent } from './sheet-date.component';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';

describe('SheetDateComponent', () => {
  let fixture: ComponentFixture<SheetDateComponent>;
  let component: SheetDateComponent;

  beforeEach(async () => {
    sessionStorage.clear();

    const businessDataSpy = jasmine.createSpyObj('BusinessDataService', ['getShops', 'getDaySheets', 'getOpeningStock']);
    businessDataSpy.getShops.and.returnValue(of([
      { shopId: 'KKD41', id: 'KKD41', name: 'Happy Wines', owner: 'SAI', ownerName: 'SAI', openingDate: '2026-09-01' }
    ]));
    businessDataSpy.getDaySheets.and.returnValue(of([
      { shopId: 'KKD41', date: '2026-09-09', records: [] }
    ]));
    businessDataSpy.getOpeningStock.and.resolveTo(null);

    const authSpy = jasmine.createSpyObj('AuthService', ['currentUser', 'logout'], {
      currentUser: () => ({ name: 'Cashier 1', role: 'Cashier', shopId: 'KKD41' })
    });

    await TestBed.configureTestingModule({
      imports: [SheetDateComponent],
      providers: [
        provideNoopAnimations(),
        { provide: BusinessDataService, useValue: businessDataSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate'), navigateByUrl: jasmine.createSpy('navigateByUrl') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SheetDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('marks the page as loading until the next pending date is resolved', () => {
    const expectedDate = (component as any).getNextPendingDate();
    expect(component.isLoadingPage).toBeFalse();
    expect(component.date).toBe(expectedDate);
  });

  it('clears the date when no pending date remains through today', () => {
    component.openingDate = component.today;
    component.submittedDates = [component.today];
    component.date = component.today;

    component.dateChanged();

    expect(component.date).toBe('');
    expect(component.dateError).toContain('no pending day sheets');
    expect(component.showOpeningStockButton).toBeFalse();
  });
});

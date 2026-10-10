import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DailySalesEntryComponent } from './daily-sales-entry.component';
import { AuthService } from '../../services/auth.service';

describe('DailySalesEntryComponent', () => {
  let component: DailySalesEntryComponent;
  let fixture: ComponentFixture<DailySalesEntryComponent>;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();

    const authSpy = jasmine.createSpyObj('AuthService', ['currentUser'], {
      currentUser: () => ({ shopId: 'KKD41', role: 'User' })
    });

    await TestBed.configureTestingModule({
      imports: [DailySalesEntryComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DailySalesEntryComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('allows saving a newly searched brand with SEARCHED code', () => {
    component.selectedBrand = { name: 'Royal Green', code: 'SEARCHED' };
    component.search = 'Royal Green';
    component.rows = [
      { size: '1000ml', bottles: 10, price: 950 },
      { size: '750ml', bottles: 20, price: 720 }
    ];

    component.save();

    expect(component.saveError).toBe('');
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.daySheet') || '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].brand).toBe('Royal Green');
    expect(router.navigate).toHaveBeenCalledWith(['/day-sheet']);
  });

  it('prefers the live typed search value over the stale default brand when saving', () => {
    sessionStorage.setItem('vinoledger.daySheet', JSON.stringify([
      { brand: 'Test Brand', code: 'TEST', date: '2024-01-01', sizes: [], difference: 0, remarks: '' }
    ]));

    component.search = 'Royal Green';
    component.selectedBrand = { name: 'Test Brand', code: 'TEST' };
    component.rows = [
      { size: '1000ml', bottles: 10, price: 950 },
      { size: '750ml', bottles: 20, price: 720 }
    ];

    component.save();

    expect(component.saveError).toBe('');
    const saved = JSON.parse(sessionStorage.getItem('vinoledger.daySheet') || '[]');
    expect(saved.length).toBe(2);
    expect(saved[1].brand).toBe('Royal Green');
    expect(router.navigate).toHaveBeenCalledWith(['/day-sheet']);
  });

  it('updates the existing brand when it is selected again', () => {
    sessionStorage.setItem('vinoledger.daySheet', JSON.stringify([
      { brand: 'Royal Green', code: 'SEARCHED', date: '2024-01-01', sizes: [], difference: 0, remarks: '' }
    ]));
    component.search = 'Royal Green';
    component.selectedBrand = { name: 'Royal Green', code: 'SEARCHED' };
    component.rows[0].bottles = 12;

    component.save();

    const saved = JSON.parse(sessionStorage.getItem('vinoledger.daySheet') || '[]');
    expect(component.saveError).toBe('');
    expect(saved.length).toBe(1);
    expect(saved[0].sizes[0].closing).toBe(12);
    expect(router.navigate).toHaveBeenCalledWith(['/day-sheet']);
  });
});

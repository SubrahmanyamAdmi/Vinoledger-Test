import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { BusinessDataService } from './services/business-data.service';
import { IconComponent } from './shared/icon/icon.component';
import { AppHeaderComponent } from './shared/app-header/app-header.component';

describe('AppComponent', () => {
  let currentUser: jasmine.Spy;
  let isLoggedIn: jasmine.Spy;

  beforeEach(async () => {
    currentUser = jasmine.createSpy('currentUser').and.returnValue(null);
    isLoggedIn = jasmine.createSpy('isLoggedIn').and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        RouterTestingModule,
        IconComponent,
        AppHeaderComponent
      ],
      declarations: [
        AppComponent
      ],
      providers: [
        { provide: AuthService, useValue: { currentUser, isLoggedIn, getRegisteredShops: () => [] } },
        { provide: BusinessDataService, useValue: { getShops: () => of([]) } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'vinoledger'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('vinoledger');
  });

  it('should hide mobile navigation while signed out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.bottom-tabbar')).toBeNull();
  });

  it('should show owner navigation while signed in', () => {
    currentUser.and.returnValue({ role: 'Owner' });
    isLoggedIn.and.returnValue(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const tabLabels = (fixture.nativeElement as HTMLElement).querySelectorAll('.tab-item span');
    const labels: string[] = [];
    for (let index = 0; index < tabLabels.length; index += 1) {
      labels.push(tabLabels.item(index).textContent?.trim() || '');
    }
    expect(labels).toEqual(['Home', 'Sales', 'Invoices', 'Partners', 'Stock', 'Invoice', 'Reports', 'Profile', 'Help']);
  });

  it('should show the five primary destinations in Cashier navigation', () => {
    currentUser.and.returnValue({ role: 'User' });
    isLoggedIn.and.returnValue(true);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const desktopLabels = Array.from(compiled.querySelectorAll('.sidebar-item span')).map((item) => item.textContent?.trim());
    const mobileLabels = Array.from(compiled.querySelectorAll('.tab-item span')).map((item) => item.textContent?.trim());

    expect(desktopLabels).toEqual(['Cashier Home', 'Day Sheet', 'Manage Partners Transactions', 'Stock', 'Profile']);
    expect(mobileLabels).toEqual(['Home', 'Day Sheet', 'Partners', 'Stock', 'Profile']);
  });

  it('should keep only Invoices active on the owner invoices route', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/owner/invoices');

    expect(fixture.componentInstance.isActive('/owner')).toBeFalse();
    expect(fixture.componentInstance.isActive('/owner/invoices')).toBeTrue();
  });

  it('should keep Admin Day Sheet Entry active while the selected sheet is open', () => {
    currentUser.and.returnValue({ role: 'Admin' });
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/day-sheet');

    expect(fixture.componentInstance.isActive('/admin/day-sheet-entry')).toBeTrue();
    expect(fixture.componentInstance.isActive('/day-sheet')).toBeFalse();
  });

  it('should keep User Day Sheet setup active while the selected sheet is open', () => {
    currentUser.and.returnValue({ role: 'User' });
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/day-sheet');

    expect(fixture.componentInstance.isActive('/sheet-date')).toBeTrue();
    expect(fixture.componentInstance.isActive('/day-sheet')).toBeFalse();
  });
});

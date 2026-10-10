import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AppDateInputComponent } from './date-input.component';

describe('AppDateInputComponent', () => {
  let fixture: ComponentFixture<AppDateInputComponent>;
  let component: AppDateInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, NoopAnimationsModule, AppDateInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppDateInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should expose the bound ISO date through the Material input', () => {
    component.writeValue('2025-06-30');
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('text');
    expect(input.readOnly).toBeTrue();
    expect(input.getAttribute('placeholder')).toBe('Select date');
    expect(component.value).toBe('2025-06-30');
    expect(component.dateValue?.getFullYear()).toBe(2025);
    expect(component.dateValue?.getMonth()).toBe(5);
    expect(component.dateValue?.getDate()).toBe(30);
  });

  it('should default the date limits to the shop opening date and local today', () => {
    sessionStorage.setItem('vinoledger.shop', JSON.stringify({ openingDate: '2026-01-15' }));
    fixture = TestBed.createComponent(AppDateInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const today = new Date();
    const expectedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(component.minDate?.getFullYear()).toBe(2026);
    expect(component.minDate?.getMonth()).toBe(0);
    expect(component.minDate?.getDate()).toBe(15);
    expect(component.maxDate.toDateString()).toBe(today.toDateString());
    sessionStorage.removeItem('vinoledger.shop');
  });
});

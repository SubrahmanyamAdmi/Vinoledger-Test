import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-date-input',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDatepickerModule, MatNativeDateModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field class="vl-date-field" appearance="outline">
      <input
        matInput
        [id]="id"
        [attr.name]="name || null"
        [attr.aria-label]="ariaLabel"
        [placeholder]="placeholder"
        [disabled]="disabled"
        readonly
        [matDatepicker]="picker"
        [min]="minDate"
        [max]="maxDate"
        [value]="dateValue"
        (dateChange)="onDateChange($event.value)"
        (blur)="onTouched()"
      />
      <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
      <mat-datepicker #picker></mat-datepicker>
    </mat-form-field>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .vl-date-field.mat-mdc-form-field {
      display: block;
      width: 100%;
      margin: 0;
      font-family: 'Inter', sans-serif;
    }
    .vl-date-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
    .vl-date-field .mat-mdc-text-field-wrapper {
      min-height: 44px;
      padding: 0 12px;
      border-radius: 6px;
      background: var(--vl-white, #fff);
    }
    .vl-date-field .mat-mdc-form-field-flex,
    .vl-date-field .mat-mdc-form-field-infix {
      min-height: 44px;
    }
    .vl-date-field .mat-mdc-form-field-infix {
      width: auto;
      padding: 10px 0;
    }
    .vl-date-field .mdc-notched-outline__leading,
    .vl-date-field .mdc-notched-outline__notch,
    .vl-date-field .mdc-notched-outline__trailing {
      border-color: var(--vl-border, #e5ded0) !important;
    }
    .vl-date-field.mat-focused .mdc-notched-outline__leading,
    .vl-date-field.mat-focused .mdc-notched-outline__notch,
    .vl-date-field.mat-focused .mdc-notched-outline__trailing {
      border-color: var(--vl-champagne, #d4b56a) !important;
      border-width: 1px !important;
    }
    @media (max-width: 899px) {
      .vl-date-field .mat-mdc-text-field-wrapper,
      .vl-date-field .mat-mdc-form-field-flex,
      .vl-date-field .mat-mdc-form-field-infix {
        min-height: 48px;
      }
    }
  `],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AppDateInputComponent),
    multi: true,
  }],
})
export class AppDateInputComponent implements ControlValueAccessor {
  private readonly sessionOpeningDate = this.readSessionOpeningDate();

  @Input() id = '';
  @Input() name = '';
  @Input() ariaLabel = 'Select a date';
  @Input() placeholder = 'Select date';
  @Input() min: string | null = null;
  @Input() max: string | null = null;
  @Input() disabled = false;
  @Input() useShopOpeningDate = true;

  value: string = '';

  get minDate(): Date | null {
    return this.parseIsoDate(this.min || (this.useShopOpeningDate ? this.sessionOpeningDate : null));
  }

  get maxDate(): Date {
    return this.parseIsoDate(this.max) || new Date();
  }

  get dateValue(): Date | null {
    return this.parseIsoDate(this.value);
  }

  private onChange: (value: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onDateChange(date: Date | null): void {
    const nextValue = date ? this.toIsoDate(date) : '';
    this.value = nextValue;
    this.onChange(nextValue);
  }

  private readSessionOpeningDate(): string | null {
    try {
      const shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
      const date = String(shop.openingDate || shop.createdAt || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    } catch {
      return null;
    }
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private parseIsoDate(value: string | null): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
}

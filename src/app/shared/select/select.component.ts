import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

export type SelectValue = string | number | boolean;

export interface AppSelectOption {
  value: SelectValue;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <select
      [id]="id"
      class="vl-select"
      [attr.aria-label]="ariaLabel"
      [disabled]="disabled"
      [value]="stringifyValue(value)"
      (change)="changeValue(($any($event.target).value))"
    >
      <option value="">{{ placeholder }}</option>
      <option
        *ngFor="let option of options; trackBy: trackByValue"
        [value]="stringifyValue(option.value)"
        [disabled]="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
  `],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AppSelectComponent),
    multi: true,
  }],
})
export class AppSelectComponent implements ControlValueAccessor {
  @Input() id = '';
  @Input() ariaLabel = 'Select an option';
  @Input() placeholder = 'Select an option';
  @Input() options: AppSelectOption[] = [];

  value: SelectValue | null = null;
  disabled = false;

  private onChange: (value: SelectValue | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: SelectValue | null): void {
    this.value = value;
  }

  stringifyValue(value: SelectValue | null | undefined): string {
    return value === null || value === undefined ? '' : globalThis.String(value);
  }

  trackByValue(_index: number, option: AppSelectOption): SelectValue {
    return option.value;
  }

  registerOnChange(fn: (value: SelectValue | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  changeValue(rawValue: string): void {
    const value = this.normalizeValue(rawValue);
    this.value = value;
    this.onChange(value);
    this.onTouched();
  }

  private normalizeValue(rawValue: string): SelectValue | null {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      return null;
    }

    if (rawValue === 'true') {
      return true;
    }

    if (rawValue === 'false') {
      return false;
    }

    if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      return Number(rawValue);
    }

    return rawValue;
  }
}

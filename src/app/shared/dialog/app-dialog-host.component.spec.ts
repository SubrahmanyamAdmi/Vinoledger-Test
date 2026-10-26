import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppDialogHostComponent } from './app-dialog-host.component';
import { AppDialogService } from './app-dialog.service';

describe('AppDialogHostComponent', () => {
  let fixture: ComponentFixture<AppDialogHostComponent>;
  let component: AppDialogHostComponent;
  let dialog: AppDialogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppDialogHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppDialogHostComponent);
    component = fixture.componentInstance;
    dialog = TestBed.inject(AppDialogService);
    fixture.detectChanges();
  });

  it('renders a themed confirmation with custom content and button labels', async () => {
    const result = dialog.show({
      type: 'confirmation',
      title: 'Confirm transfer',
      message: 'Review the transfer details.',
      confirmText: 'Transfer',
      cancelText: 'Go back',
      details: [{ label: 'Amount', value: '₹500.00' }],
    });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="dialog"]')).not.toBeNull();
    expect(element.querySelector('#app-dialog-title')?.textContent).toContain('Confirm transfer');
    expect(element.querySelector('.dialog-detail dd')?.textContent).toContain('₹500.00');
    expect(Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim())).toContain('Transfer');
    expect(Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim())).toContain('Go back');

    component.close(true);
    expect(await result).toBeTrue();
  });

  it('uses alertdialog semantics for warnings and resolves Escape as cancelled', async () => {
    const result = dialog.show({
      type: 'warning',
      title: 'Unsaved changes',
      message: 'Leave without saving?',
      confirmText: 'Leave',
      cancelText: 'Stay',
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alertdialog"]')).not.toBeNull();

    component.closeOnEscape();
    expect(await result).toBeFalse();
  });

  it('closes a previous dialog as cancelled when a new request replaces it', async () => {
    const firstResult = dialog.show({ type: 'info', title: 'First', message: 'First dialog' });
    const secondResult = dialog.show({ type: 'success', title: 'Second', message: 'Second dialog' });

    expect(await firstResult).toBeFalse();
    dialog.close(true);
    expect(await secondResult).toBeTrue();
  });
});

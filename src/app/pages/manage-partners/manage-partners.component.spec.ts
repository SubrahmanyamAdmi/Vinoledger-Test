import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { AppDialogService } from '../../shared/dialog/app-dialog.service';
import { ManagePartnersComponent } from './manage-partners.component';

describe('ManagePartnersComponent profit distributions', () => {
  let component: ManagePartnersComponent;
  let fixture: ComponentFixture<ManagePartnersComponent>;
  let currentUser: { shopId: string; role: string };
  let dialog: jasmine.SpyObj<AppDialogService>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    currentUser = { shopId: 'SHOP-A', role: 'Owner' };
    dialog = jasmine.createSpyObj<AppDialogService>('AppDialogService', ['show']);
    dialog.show.and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      imports: [ManagePartnersComponent],
      providers: [
        { provide: AuthService, useValue: { currentUser: () => currentUser } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate'), navigateByUrl: jasmine.createSpy('navigateByUrl') } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        { provide: FirestoreService, useValue: { getDocumentOnce: () => Promise.resolve(null), setDocument: () => Promise.resolve() } },
        { provide: AppDialogService, useValue: dialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagePartnersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('splits a 50-lakh withdrawal using saved partner percentages', () => {
    component.partners = [
      { id: 'P1', name: 'Partner One', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 60, status: 'Active', notes: '' },
      { id: 'P2', name: 'Partner Two', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 40, status: 'Inactive', notes: '' },
    ];
    component.distributionAmount = 5000000;

    expect(component.profitDistributionPreview.map((share) => share.amount)).toEqual([3000000, 2000000]);
  });

  it('allocates rounding cents so the partner shares equal the withdrawal exactly', () => {
    component.partners = [
      { id: 'P1', name: 'Partner One', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 33.33, status: 'Active', notes: '' },
      { id: 'P2', name: 'Partner Two', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 33.33, status: 'Active', notes: '' },
      { id: 'P3', name: 'Partner Three', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 33.34, status: 'Active', notes: '' },
    ];
    component.distributionAmount = 10.01;

    const shares = component.profitDistributionPreview;
    expect(shares.map((share) => share.amount)).toEqual([3.34, 3.33, 3.34]);
    expect(shares.reduce((sum, share) => sum + share.amount, 0)).toBe(10.01);
  });

  it('records an owner distribution separately without changing cashier pending transactions', async () => {
    component.partners = [
      { id: 'P1', name: 'Partner One', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 50, status: 'Active', notes: '' },
      { id: 'P2', name: 'Partner Two', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 50, status: 'Active', notes: '' },
    ];
    component.partnerTransactions = [{
      id: 'TXN-1',
      partnerName: 'Partner One',
      partnerContact: '',
      transactionType: 'Cash',
      product: 'Cash',
      quantity: 'Cash',
      amount: 1000,
      paymentReceived: 0,
      paymentStatus: 'Pending',
      createdAt: new Date().toISOString(),
    }];
    component.distributionAmount = 100;

    await component.saveProfitDistribution();

    expect(dialog.show).toHaveBeenCalledWith(jasmine.objectContaining({
      type: 'confirmation',
      title: 'Confirm profit distribution',
      confirmText: 'Record distribution',
      cancelText: 'Review again',
      details: [
        { label: 'Partner One · 50.00%', value: '₹50.00' },
        { label: 'Partner Two · 50.00%', value: '₹50.00' },
        { label: 'Total company withdrawal', value: '₹100.00' },
      ],
    }));
    const saved = JSON.parse(localStorage.getItem('vinoledger.partners.SHOP-A') || '{}');
    expect(saved.profitDistributions[0].amount).toBe(100);
    expect(saved.profitDistributions[0].shares.map((share: { amount: number }) => share.amount)).toEqual([50, 50]);
    expect(saved.partnerTransactions[0].paymentStatus).toBe('Pending');
    expect(component.message).toBe('Profit distribution recorded successfully.');
  });

  it('does not allow a cashier to create a profit distribution', async () => {
    currentUser = { shopId: 'SHOP-A', role: 'User' };
    component.distributionAmount = 100;

    await component.saveProfitDistribution();

    expect(component.profitDistributions).toEqual([]);
    expect(component.error).toBe('Only the shop owner can record a profit distribution.');
  });

  it('does not record a distribution when the owner cancels the review', async () => {
    dialog.show.and.returnValue(Promise.resolve(false));
    component.partners = [
      { id: 'P1', name: 'Partner One', mobile: '', email: '', joiningDate: '', investmentAmount: 0, profitShare: 100, status: 'Active', notes: '' },
    ];
    component.distributionAmount = 100;

    await component.saveProfitDistribution();

    expect(component.profitDistributions).toEqual([]);
    expect(localStorage.getItem('vinoledger.partners.SHOP-A')).toBeNull();
    expect(component.isConfirmingDistribution).toBeFalse();
  });
});

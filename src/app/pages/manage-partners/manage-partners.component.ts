import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppLoaderComponent } from '../../shared/loader/app-loader.component';
import { AppSelectComponent, AppSelectOption } from '../../shared/select/select.component';
import { AppDateInputComponent } from '../../shared/date-input/date-input.component';
import { AppDialogService } from '../../shared/dialog/app-dialog.service';

interface Partner {
  id: string;
  name: string;
  mobile: string;
  email: string;
  joiningDate: string;
  investmentAmount: number;
  profitShare: number;
  status: 'Active' | 'Inactive';
  notes: string;
}

type TransactionType = 'Stock Taken' | 'Cash';

interface PartnerTransaction {
  id: string;
  partnerName: string;
  partnerContact: string;
  transactionType: TransactionType;
  product: string;
  detail?: string;
  quantity: string;
  amount: number;
  paymentReceived: number;
  paymentStatus: 'Paid' | 'Pending';
  comment?: string;
  createdAt: string;
}

interface ProfitDistributionShare {
  partnerId: string;
  partnerName: string;
  profitShare: number;
  amount: number;
}

interface ProfitDistribution {
  id: string;
  amount: number;
  createdAt: string;
  shares: ProfitDistributionShare[];
}

@Component({
  selector: 'app-manage-partners',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppLoaderComponent, AppSelectComponent, AppDateInputComponent],
  templateUrl: './manage-partners.component.html',
  styleUrls: ['./manage-partners.component.scss']
})
export class ManagePartnersComponent implements OnInit {
  shopId = '';
  readonly today = this.toLocalIsoDate(new Date());
  readonly shopOpeningDate = this.readShopOpeningDate();
  partnerCount = 0;
  partners: Partner[] = [];
  message = '';
  error = '';
  isSaving = false;
  isConfirmingDistribution = false;
  isLoading = true;
  isEditing = false;
  showSetupPanel = true;
  activeTab: 'details' | 'transactions' | 'distributions' = 'transactions';
  mobileTabOpen = false;

  openTab(tab: 'details' | 'transactions' | 'distributions') {
    this.activeTab = tab;
    this.mobileTabOpen = true;
  }
  readonly partnerStatusOptions: AppSelectOption[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];
  readonly transactionTypeOptions: AppSelectOption[] = [
    { value: 'Stock Taken', label: 'Stock Taken' },
    { value: 'Cash', label: 'Cash' },
  ];
  partnerTransactions: PartnerTransaction[] = [];
  profitDistributions: ProfitDistribution[] = [];
  distributionAmount = 0;
  selectedPartnerId: string | null = null;
  selectedPartnerForPopup: { name: string; contact: string; pending: number; items: PartnerTransaction[] } | null = null;
  newTransactionDraft: {
    partnerName: string;
    partnerContact: string;
    transactionType: TransactionType;
    product: string;
    quantity: string;
    amount: number;
    paymentStatus: 'Pending' | 'Paid';
    comment: string;
  } = {
    partnerName: '',
    partnerContact: '',
    transactionType: 'Stock Taken',
    product: '',
    quantity: '',
    amount: 0,
    paymentStatus: 'Pending',
    comment: '',
  };

  constructor(
    public auth: AuthService,
    private router: Router,
    private firestore: FirestoreService,
    private route: ActivatedRoute,
    private dialog: AppDialogService
  ) {
    this.shopId = String(this.auth.currentUser()?.shopId || this.readSessionShopId());
    this.loadPartners();
    this.loadDemoTransactions();
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.selectedPartnerId = params.get('id');
      const partner = this.partners.find((item) => item.id === this.selectedPartnerId);

      if (this.selectedPartnerId && partner) {
        this.activeTab = 'transactions';
        this.mobileTabOpen = true;
        this.newTransactionDraft.partnerName = partner.name;
        this.newTransactionDraft.partnerContact = partner.mobile;
        this.newTransactionDraft.transactionType = 'Stock Taken';
        this.newTransactionDraft.product = '';
        this.newTransactionDraft.quantity = '';
        this.newTransactionDraft.amount = 0;
        this.newTransactionDraft.paymentStatus = 'Pending';
        this.newTransactionDraft.comment = '';
      }
    });
  }

  get selectedPartner() {
    return this.partners.find((partner) => partner.id === this.selectedPartnerId) || null;
  }

  get selectedPartnerTransactions() {
    const partnerName = this.selectedPartner?.name;
    if (!partnerName) {
      return [];
    }
    return this.partnerTransactions.filter((entry) => entry.partnerName === partnerName);
  }

  get selectedPartnerPending() {
    if (!this.selectedPartner?.name) {
      return 0;
    }
    return this.getPendingForPartner(this.selectedPartner.name);
  }

  getPendingForPartner(partnerName: string): number {
    return this.partnerTransactions
      .filter((entry) => entry.partnerName === partnerName)
      .reduce((sum, entry) => {
        const amount = Number(entry.amount || 0);
        if (entry.paymentStatus === 'Paid') {
          return Math.max(0, sum - amount);
        }
        return sum + amount;
      }, 0);
  }

  getTotalForSelectedPartner(type?: TransactionType): number {
    const records = this.selectedPartnerTransactions;
    if (!type) {
      return records.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    }
    return records
      .filter((entry) => entry.transactionType === type)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  getPaidAmountForSelectedPartner(): number {
    return this.selectedPartnerTransactions.reduce((sum, entry) => sum + Number(entry.paymentReceived || 0), 0);
  }

  getStockTakenCountForSelectedPartner(): number {
    return this.selectedPartnerTransactions.filter((entry) => entry.transactionType === 'Stock Taken').length;
  }

  getProfitPaidForSelectedPartner(): number {
    return this.selectedPartnerTransactions
      .filter((entry) => entry.paymentStatus === 'Paid')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  getProfitAllocatedForSelectedPartner(): number {
    if (!this.selectedPartner) {
      return 0;
    }
    return (Number(this.selectedPartner.investmentAmount || 0) * Number(this.selectedPartner.profitShare || 0)) / 100;
  }

  getPaymentRadioName(recordId: string): string {
    return `payment-${recordId}`;
  }

  setPaymentPending(record: PartnerTransaction) {
    this.updateTransactionPayment(record, Number(record.amount || 0) - Number(record.paymentReceived || 0), 'Pending');
  }

  setPaymentPaid(record: PartnerTransaction) {
    this.updateTransactionPayment(record, Number(record.amount || 0), 'Paid');
  }

  updateReceivedAmount(record: PartnerTransaction, value: string) {
    const receivedValue = Number(value || 0);
    this.updateTransactionPayment(record, receivedValue, record.paymentStatus);
  }

  get isCashier() {
    return this.auth.currentUser()?.role === 'User';
  }

  get isOwner() {
    return this.auth.currentUser()?.role === 'Owner';
  }

  get showOwnerDetailsTab() {
    return !this.isCashier;
  }

  get visibleTabs() {
    return this.isCashier ? ['transactions'] : ['transactions', 'details'];
  }

  get isCashTransaction() {
    return this.newTransactionDraft.transactionType === 'Cash';
  }

  get partnerTransactionSummary() {
    return this.partners.map((partner) => {
      const items = this.partnerTransactions.filter((entry) => entry.partnerName === partner.name);
      const pending = items.reduce((sum, entry) => {
        const amount = Number(entry.amount || 0);
        return entry.paymentStatus === 'Paid' ? Math.max(0, sum - amount) : sum + amount;
      }, 0);
      return {
        partner,
        contact: partner.mobile,
        pending,
        items,
      };
    });
  }

  get totalProfitShare() {
    return this.partners.reduce((sum, partner) => sum + (Number(partner.profitShare) || 0), 0);
  }

  get isValidShare() {
    return Math.abs(this.totalProfitShare - 100) < 0.01;
  }

  get profitDistributionPreview(): ProfitDistributionShare[] {
    const amountCents = Math.round(Number(this.distributionAmount) * 100);
    const validShares = this.partners.every((partner) => Number.isFinite(Number(partner.profitShare)) && Number(partner.profitShare) >= 0);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !this.isValidShare || !validShares || !this.partners.length) {
      return [];
    }

    const allocations = this.partners.map((partner, index) => {
      const exactCents = amountCents * (Number(partner.profitShare) || 0) / this.totalProfitShare;
      const wholeCents = Math.floor(exactCents);
      return { partner, index, cents: wholeCents, remainder: exactCents - wholeCents };
    });
    const remainingCents = amountCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
    const remainderOrder = [...allocations].sort((left, right) => right.remainder - left.remainder || left.index - right.index);
    for (let index = 0; index < remainingCents; index++) {
      remainderOrder[index % remainderOrder.length].cents++;
    }

    return allocations.map(({ partner, cents }) => ({
      partnerId: partner.id,
      partnerName: partner.name,
      profitShare: Number(partner.profitShare) || 0,
      amount: cents / 100,
    }));
  }

  get canDistributeProfit() {
    return this.isOwner && !this.isSaving && !this.isConfirmingDistribution && this.partners.length > 0 && this.isValidShare &&
      this.hasCompletePartnerNames &&
      this.partners.every((partner) => Number.isFinite(Number(partner.profitShare)) && Number(partner.profitShare) >= 0);
  }

  get hasCompletePartnerNames() {
    return this.partners.every((partner) => partner.name.trim());
  }

  createPartnerRows() {
    if (this.isCashier) {
      return;
    }
    const count = Math.floor(Number(this.partnerCount));
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      this.error = 'Enter a number of partners between 1 and 100.';
      return;
    }
    this.error = '';
    this.message = '';
    this.isEditing = false;
    this.showSetupPanel = false;
    this.activeTab = 'details';
    this.mobileTabOpen = true;
    this.partners = Array.from({ length: count }, (_, index) => this.partners[index] || this.createPartner(index + 1));
  }

  get editButtonLabel() {
    return this.isEditing ? 'Update Details' : 'Edit Details';
  }

  openPartnerDetails(partner: Partner) {
    this.selectedPartnerId = partner.id;
    this.router.navigate(['/manage-partners', partner.id]);
  }

  openPartnerTransactionPopup(partner: { partner: Partner; pending: number; items: PartnerTransaction[] }) {
    this.selectedPartnerForPopup = {
      name: partner.partner.name,
      contact: partner.partner.mobile,
      pending: partner.pending,
      items: partner.items,
    };
    this.newTransactionDraft = {
      partnerName: partner.partner.name,
      partnerContact: partner.partner.mobile,
      transactionType: 'Stock Taken',
      product: '',
      quantity: '',
      amount: 0,
      paymentStatus: 'Pending',
      comment: '',
    };
  }

  closePartnerTransactionPopup() {
    this.selectedPartnerForPopup = null;
    this.newTransactionDraft = {
      partnerName: '',
      partnerContact: '',
      transactionType: 'Stock Taken',
      product: '',
      quantity: '',
      amount: 0,
      paymentStatus: 'Pending',
      comment: '',
    };
  }

  async saveTransactionEntry() {
    const draft = this.newTransactionDraft;
    const isCash = draft.transactionType === 'Cash';

    if (!draft.partnerName || !draft.amount || draft.amount <= 0) {
      this.error = 'Enter the partner and a valid amount before saving.';
      return;
    }

    if (!isCash && (!draft.product || !draft.quantity)) {
      this.error = 'Enter the product and quantity for stock transactions before saving.';
      return;
    }

    if (isCash && !draft.comment?.trim()) {
      this.error = 'Please add a reason for the cash withdrawal before saving.';
      return;
    }

    const entry: PartnerTransaction = {
      id: `TXN-${Date.now()}`,
      partnerName: draft.partnerName,
      partnerContact: draft.partnerContact,
      transactionType: draft.transactionType,
      product: isCash ? 'Cash' : draft.product,
      quantity: isCash ? 'Cash' : draft.quantity,
      amount: Number(draft.amount),
      paymentReceived: draft.paymentStatus === 'Paid' ? Number(draft.amount) : 0,
      paymentStatus: draft.paymentStatus,
      comment: draft.comment?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    this.partnerTransactions = [entry, ...this.partnerTransactions];
    this.message = 'Partner expense saved successfully.';
    this.error = '';

    try {
      const data = { shopId: this.shopId, partnerCount: this.partners.length, partners: this.partners, partnerTransactions: this.partnerTransactions, profitDistributions: this.profitDistributions, updatedAt: new Date().toISOString() };
      localStorage.setItem(this.storageKey(), JSON.stringify(data));
      if (this.isFirebaseConfigured() && this.shopId) {
        await this.firestore.setDocument('partnerManagement', this.shopId, data);
      }
    } catch {
      this.error = 'Firebase sync failed. The transaction was saved locally.';
      this.message = 'Partner expense saved locally. Firebase sync failed.';
    }

    this.closePartnerTransactionPopup();
  }

  async saveProfitDistribution() {
    if (this.isSaving || this.isConfirmingDistribution) {
      return;
    }
    this.error = '';
    this.message = '';
    const amountCents = Math.round(Number(this.distributionAmount) * 100);

    if (!this.isOwner) {
      this.error = 'Only the shop owner can record a profit distribution.';
      return;
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      this.error = 'Enter a valid distribution amount greater than zero.';
      return;
    }
    if (!this.partners.length || !this.partners.every((partner) => partner.name.trim())) {
      this.error = 'Complete the names of all partners before recording a distribution.';
      return;
    }
    if (!this.partners.every((partner) => Number.isFinite(Number(partner.profitShare)) && Number(partner.profitShare) >= 0) || !this.isValidShare) {
      this.error = `Partner profit shares must total 100% before distributing. Current total: ${this.totalProfitShare.toFixed(2)}%.`;
      return;
    }

    const shares = this.profitDistributionPreview;
    const amount = amountCents / 100;
    this.isConfirmingDistribution = true;
    let confirmed: boolean;
    try {
      confirmed = await this.dialog.show({
        type: 'confirmation',
        title: 'Confirm profit distribution',
        message: 'Review the total company withdrawal and each partner’s share before recording this distribution.',
        confirmText: 'Record distribution',
        cancelText: 'Review again',
        details: [
          ...shares.map((share) => ({
            label: `${share.partnerName} · ${share.profitShare.toFixed(2)}%`,
            value: `₹${share.amount.toFixed(2)}`,
          })),
          { label: 'Total company withdrawal', value: `₹${amount.toFixed(2)}` },
        ],
      });
    } finally {
      this.isConfirmingDistribution = false;
    }
    if (!confirmed) {
      return;
    }

    const createdAt = new Date().toISOString();
    const distribution: ProfitDistribution = {
      id: `PROFIT-${Date.now()}`,
      amount,
      createdAt,
      shares,
    };
    const distributions = [distribution, ...this.profitDistributions];
    const data = {
      shopId: this.shopId,
      partnerCount: this.partners.length,
      partners: this.partners,
      partnerTransactions: this.partnerTransactions,
      profitDistributions: distributions,
      updatedAt: createdAt,
    };

    this.isSaving = true;
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(data));
    } catch {
      this.error = 'Could not save the profit distribution locally. No distribution was recorded.';
      this.isSaving = false;
      return;
    }

    this.profitDistributions = distributions;
    this.distributionAmount = 0;
    this.message = 'Profit distribution recorded successfully.';
    try {
      if (this.isFirebaseConfigured() && this.shopId) {
        await this.firestore.setDocument('partnerManagement', this.shopId, data);
      }
    } catch {
      this.error = 'Firebase sync failed. The profit distribution was saved locally.';
      this.message = 'Profit distribution saved locally. Firebase sync failed.';
    } finally {
      this.isSaving = false;
    }
  }

  updateTransactionPayment(item: PartnerTransaction, paymentValue: number, status: 'Paid' | 'Pending') {
    const normalized = Math.max(0, Number(paymentValue) || 0);
    item.paymentReceived = normalized;
    item.paymentStatus = status;
    if (status === 'Paid' || normalized >= item.amount) {
      item.paymentStatus = 'Paid';
      item.paymentReceived = Math.max(0, item.amount);
    } else {
      item.paymentStatus = 'Pending';
    }
    this.message = `Payment status updated for ${item.partnerName}.`;
    this.error = '';
  }

  toggleEditMode() {
    if (!this.partners.length) {
      return;
    }

    if (!this.isEditing) {
      this.message = '';
      this.error = '';
      this.isEditing = true;
      this.showSetupPanel = true;
      this.activeTab = 'details';
      this.mobileTabOpen = true;
      return;
    }

    this.savePartners();
  }

  deletePartner(index: number) {
    if (!this.isEditing || index < 0 || index >= this.partners.length) {
      return;
    }

    this.partners.splice(index, 1);
    this.partnerCount = this.partners.length;
    this.error = '';
    this.message = 'Partner removed successfully.';

    if (!this.partners.length) {
      this.showSetupPanel = true;
      this.isEditing = true;
    }
  }

  async savePartners() {
    this.error = '';
    this.message = '';
    if (!this.partners.length) {
      this.error = 'Enter the number of partners and create the partner list first.';
      return;
    }
    const invalidIndex = this.partners.findIndex((partner) =>
      !partner.name.trim() || !/^\d{10}$/.test(partner.mobile.replace(/\D/g, '')) ||
      (String(partner.email || '').trim() && !/^\S+@\S+\.\S+$/.test(String(partner.email || '').trim())) ||
      Number(partner.investmentAmount) < 0 || Number(partner.profitShare) < 0 || Number(partner.profitShare) > 100
    );
    if (invalidIndex >= 0) {
      this.error = `Complete Partner ${invalidIndex + 1} with a valid name, 10-digit mobile number, optional valid email, and amounts.`;
      return;
    }
    if (!this.isValidShare) {
      this.error = `Total Profit Share must equal 100%. Current total: ${this.totalProfitShare.toFixed(2)}%.`;
      return;
    }

    const data = {
      shopId: this.shopId,
      partnerCount: this.partners.length,
      partners: this.partners,
      partnerTransactions: this.partnerTransactions,
      profitDistributions: this.profitDistributions,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(this.storageKey(), JSON.stringify(data));
    this.isSaving = true;
    try {
      if (this.isFirebaseConfigured() && this.shopId) {
        await this.firestore.setDocument('partnerManagement', this.shopId, data);
      }
      this.isEditing = false;
      this.showSetupPanel = false;
      this.message = 'Partner details saved successfully.';
    } catch {
      this.isEditing = false;
      this.showSetupPanel = false;
      this.error = 'Firebase sync failed. The partner roster was saved locally.';
      this.message = 'Saved locally. Firebase sync failed.';
    } finally {
      this.isSaving = false;
    }
  }

  goBack() {
    if (this.selectedPartnerId) {
      this.selectedPartnerId = null;
      this.router.navigate(['/manage-partners']);
      return;
    }

    const role = this.auth.currentUser()?.role;
    const homeRoute = role === 'User' ? '/cashier-home' : role === 'Admin' ? '/admin' : '/owner';
    this.router.navigateByUrl(homeRoute);
  }

  logout() {
    this.auth.logout();
  }

  private async loadPartners() {
    const local = this.readLocalPartners();
    if (local) {
      this.partnerCount = local.partnerCount;
      this.partners = local.partners;
      this.partnerTransactions = Array.isArray(local.partnerTransactions) ? local.partnerTransactions : [];
      this.profitDistributions = Array.isArray(local.profitDistributions) ? local.profitDistributions : [];
    }
    if (this.isFirebaseConfigured() && this.shopId) {
      try {
        const remote = await this.firestore.getDocumentOnce<{ partnerCount: number; partners: Partner[]; partnerTransactions: PartnerTransaction[]; profitDistributions?: ProfitDistribution[] }>('partnerManagement', this.shopId);
        if (remote?.partners?.length || Array.isArray(remote?.partnerTransactions) || Array.isArray(remote?.profitDistributions)) {
          this.partnerCount = Number(remote.partnerCount) || remote.partners?.length || this.partnerCount;
          this.partners = remote.partners || this.partners;
          this.partnerTransactions = remote.partnerTransactions || this.partnerTransactions;
          this.profitDistributions = Array.isArray(remote.profitDistributions) ? remote.profitDistributions : this.profitDistributions;
          localStorage.setItem(this.storageKey(), JSON.stringify({
            shopId: this.shopId,
            partnerCount: this.partnerCount,
            partners: this.partners,
            partnerTransactions: this.partnerTransactions,
            profitDistributions: this.profitDistributions,
            updatedAt: new Date().toISOString()
          }));
        }
      } catch {
        // Keep the local roster when Firebase is unavailable.
      }
    }
    this.isLoading = false;
  }

  private loadDemoTransactions() {
    this.partnerTransactions = [];
  }

  private createPartner(number: number): Partner {
    return { id: `PARTNER-${number}`, name: '', mobile: '', email: '', joiningDate: this.shopOpeningDate, investmentAmount: 0, profitShare: 0, status: 'Active', notes: '' };
  }

  private readShopOpeningDate(): string {
    const today = this.toLocalIsoDate(new Date());
    try {
      const shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}');
      const openingDate = String(shop.openingDate || shop.createdAt || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(openingDate) && openingDate <= today ? openingDate : today;
    } catch {
      return today;
    }
  }

  private toLocalIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private readLocalPartners(): { partnerCount: number; partners: Partner[]; partnerTransactions?: PartnerTransaction[]; profitDistributions?: ProfitDistribution[] } | null {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey()) || 'null');
      return saved?.partners?.length ? saved : null;
    } catch {
      return null;
    }
  }

  private readSessionShopId() {
    try {
      return JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{}').id || '';
    } catch {
      return '';
    }
  }

  private storageKey() {
    return `vinoledger.partners.${this.shopId || 'default'}`;
  }

  private isFirebaseConfigured() {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.appId && config.projectId && config.apiKey !== 'YOUR_API_KEY' && config.projectId !== 'YOUR_PROJECT_ID');
  }
}

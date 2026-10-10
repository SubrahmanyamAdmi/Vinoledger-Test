import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppSelectComponent, AppSelectOption } from '../../shared/select/select.component';
import { AppDateInputComponent } from '../../shared/date-input/date-input.component';

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

@Component({
  selector: 'app-manage-partners',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppSelectComponent, AppDateInputComponent],
  templateUrl: './manage-partners.component.html',
  styleUrls: ['./manage-partners.component.scss']
})
export class ManagePartnersComponent implements OnInit {
  shopId = '';
  partnerCount = 0;
  partners: Partner[] = [];
  message = '';
  error = '';
  isSaving = false;
  isLoading = true;
  isEditing = false;
  showSetupPanel = true;
  activeTab: 'details' | 'transactions' = 'transactions';
  readonly partnerStatusOptions: AppSelectOption[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];
  readonly transactionTypeOptions: AppSelectOption[] = [
    { value: 'Stock Taken', label: 'Stock Taken' },
    { value: 'Cash', label: 'Cash' },
  ];
  partnerTransactions: PartnerTransaction[] = [];
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
    private route: ActivatedRoute
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
      const data = { shopId: this.shopId, partnerCount: this.partners.length, partners: this.partners, partnerTransactions: this.partnerTransactions, updatedAt: new Date().toISOString() };
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
      (partner.email && !/^\S+@\S+\.\S+$/.test(partner.email)) ||
      Number(partner.investmentAmount) < 0 || Number(partner.profitShare) < 0 || Number(partner.profitShare) > 100
    );
    if (invalidIndex >= 0) {
      this.error = `Complete Partner ${invalidIndex + 1} with a valid name, 10-digit mobile number, email, and amounts.`;
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
    }
    if (this.isFirebaseConfigured() && this.shopId) {
      try {
        const remote = await this.firestore.getDocumentOnce<{ partnerCount: number; partners: Partner[]; partnerTransactions: PartnerTransaction[] }>('partnerManagement', this.shopId);
        if (remote?.partners?.length || Array.isArray(remote?.partnerTransactions)) {
          this.partnerCount = Number(remote.partnerCount) || remote.partners?.length || this.partnerCount;
          this.partners = remote.partners || this.partners;
          this.partnerTransactions = remote.partnerTransactions || this.partnerTransactions;
          localStorage.setItem(this.storageKey(), JSON.stringify({
            shopId: this.shopId,
            partnerCount: this.partnerCount,
            partners: this.partners,
            partnerTransactions: this.partnerTransactions,
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
    return { id: `PARTNER-${number}`, name: '', mobile: '', email: '', joiningDate: new Date().toISOString().slice(0, 10), investmentAmount: 0, profitShare: 0, status: 'Active', notes: '' };
  }

  private readLocalPartners(): { partnerCount: number; partners: Partner[]; partnerTransactions?: PartnerTransaction[] } | null {
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

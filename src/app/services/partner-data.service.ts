import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { FirestoreService } from './firestore.service';

export interface PartnerRecord {
  id: string;
  name: string;
  mobile: string;
  joiningDate: string;
  investmentAmount: number;
  profitShare: number;
  status: 'Active' | 'Inactive';
}

export interface PartnerTransactionRecord {
  id: string;
  partnerName: string;
  transactionType: 'Stock Taken' | 'Cash';
  product: string;
  detail?: string;
  amount: number;
  paymentStatus: 'Paid' | 'Pending';
  createdAt: string;
}

export interface ProfitDistributionRecord {
  id: string;
  amount: number;
  createdAt: string;
  shares: { partnerId: string; partnerName: string; profitShare: number; amount: number }[];
}

export interface PartnerManagementData {
  partners: PartnerRecord[];
  partnerTransactions: PartnerTransactionRecord[];
  profitDistributions: ProfitDistributionRecord[];
}

// Read-only access to the existing `partnerManagement` document (local copy first, then Firestore).
@Injectable({ providedIn: 'root' })
export class PartnerDataService {
  constructor(private firestore: FirestoreService) {}

  async load(shopId: string): Promise<PartnerManagementData> {
    let data = this.normalize(this.readLocal(shopId));
    if (this.isFirebaseConfigured() && shopId) {
      try {
        const remote = await this.firestore.getDocumentOnce<Partial<PartnerManagementData>>('partnerManagement', shopId);
        if (remote) {
          data = this.normalize(remote);
        }
      } catch {
        // Keep the local copy when Firebase is unavailable.
      }
    }
    return data;
  }

  private normalize(source: Partial<PartnerManagementData> | null): PartnerManagementData {
    return {
      partners: Array.isArray(source?.partners) ? source!.partners : [],
      partnerTransactions: Array.isArray(source?.partnerTransactions) ? source!.partnerTransactions : [],
      profitDistributions: Array.isArray(source?.profitDistributions) ? source!.profitDistributions : [],
    };
  }

  private readLocal(shopId: string): Partial<PartnerManagementData> | null {
    try {
      return JSON.parse(localStorage.getItem(`vinoledger.partners.${shopId || 'default'}`) || 'null');
    } catch {
      return null;
    }
  }

  private isFirebaseConfigured() {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.appId && config.projectId && config.apiKey !== 'YOUR_API_KEY' && config.projectId !== 'YOUR_PROJECT_ID');
  }
}

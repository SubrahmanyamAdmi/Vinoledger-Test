import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import { IconComponent } from '../../shared/icon/icon.component';

interface CustomerRecord {
  id: string;
  type: 'Owner' | 'Cashier';
  name: string;
  mobile: string;
  shopName: string;
  shopLocation: string;
  shopId: string;
  email: string;
}

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './admin-customers.component.html',
  styleUrls: ['./admin-customers.component.scss', './admin-page-theme.scss']
})
export class AdminCustomersComponent implements OnInit {
  customers: CustomerRecord[] = [];

  searchTerm = '';
  totalCustomers = 0;
  loading = true;
  loadError = '';

  constructor(private router: Router, private auth: AuthService, private businessData: BusinessDataService) {}

  ngOnInit() {
    forkJoin({
      shops: this.businessData.getShops(),
      users: this.businessData.getUsers(),
    }).subscribe({
      next: ({ shops, users }) => {
        const shopMap = new Map<string, any>();
        (shops || []).forEach((shop: any) => {
          const shopId = String(shop.shopId || shop.id || '').trim();
          if (shopId) {
            shopMap.set(shopId.toUpperCase(), shop);
          }
        });

        const mergedCustomers = new Map<string, CustomerRecord>();

        (users || []).forEach((user: any) => {
          const shopId = String(user.shopId || '').trim();
          const shop = shopId ? shopMap.get(shopId.toUpperCase()) : undefined;
          const role = user.role === 'Owner' ? 'Owner' : 'Cashier';
          const record: CustomerRecord = {
            id: String(user.id || `${shopId}-${user.email || user.name}`),
            type: role,
            name: user.name || 'Unknown',
            mobile: user.contactNumber || '',
            shopName: shop?.name || shop?.shopName || '',
            shopLocation: shop?.location || shop?.shopLocation || '',
            shopId: shopId || shop?.shopId || shop?.id || '',
            email: user.email || '',
          };
          mergedCustomers.set(record.id, record);
        });

        if (mergedCustomers.size === 0) {
          (shops || []).forEach((shop: any) => {
            const shopId = String(shop.shopId || shop.id || '').trim();
            const owner: CustomerRecord = {
              id: `${shopId}-owner`,
              type: 'Owner',
              name: shop.ownerName || shop.owner || 'Owner',
              mobile: shop.ownerContactNumber || shop.phone || '',
              shopName: shop.name || '',
              shopLocation: shop.location || '',
              shopId,
              email: shop.ownerEmail || shop.email || '',
            };
            mergedCustomers.set(owner.id, owner);

            (Array.isArray(shop.cashiers) ? shop.cashiers : []).forEach((cashier: any, index: number) => {
              const customer: CustomerRecord = {
                id: `${shopId}-${cashier.email || `${index}`}`,
                type: 'Cashier',
                name: cashier.name || 'Cashier',
                mobile: cashier.contactNumber || '',
                shopName: shop.name || '',
                shopLocation: shop.location || '',
                shopId,
                email: cashier.email || '',
              };
              mergedCustomers.set(customer.id, customer);
            });
          });
        }

        this.customers = Array.from(mergedCustomers.values());
        this.totalCustomers = this.customers.length;
        this.loading = false;
      },
      error: () => {
        this.loadError = 'Unable to load customers and users from Firebase.';
        this.loading = false;
      }
    });
  }

  get filteredCustomers(): CustomerRecord[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.customers;
    }

    return this.customers.filter((customer) =>
      customer.name.toLowerCase().includes(term) ||
      customer.email.toLowerCase().includes(term) ||
      customer.shopId.toLowerCase().includes(term) ||
      customer.type.toLowerCase().includes(term)
    );
  }

  deleteCustomer(customerId: string) {
    if (confirm('Are you sure you want to delete this customer?')) {
      this.customers = this.customers.filter(c => c.id !== customerId);
      this.totalCustomers = this.customers.length;
      alert('Customer deleted successfully');
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}

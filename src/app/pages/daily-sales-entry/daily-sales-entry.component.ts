import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TopbarComponent } from '../../shared/topbar/topbar.component';
import { SidenavComponent } from '../../shared/sidenav/sidenav.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-daily-sales-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatToolbarModule, TopbarComponent, SidenavComponent],
  templateUrl: './daily-sales-entry.component.html',
  styleUrls: ['./daily-sales-entry.component.scss']
})
export class DailySalesEntryComponent {
  shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{"id":"KKD41","owner":"Y Bathalaswamy"}');
  date = sessionStorage.getItem('vinoledger.date') || new Date().toISOString().slice(0, 10);
  search = '';
  saveError = '';
  isSaving = false;
  selectedBrand = { name: 'Manson House', code: 'MH2094' };
  rows = [
    { size: '1000ml', bottles: 0, price: 950 },
    { size: '750ml', bottles: 0, price: 720 },
    { size: '375ml', bottles: 0, price: 380 },
    { size: '180ml', bottles: 0, price: 190 },
    { size: '90ml', bottles: 0, price: 100 }
  ];
  constructor(public auth: AuthService, private router: Router) {}
  get total() { return this.rows.reduce((sum, row) => sum + row.bottles * row.price, 0); }
  findBrand() {
    const term = this.normalize(this.search);
    if (!term) {
      this.saveError = 'Enter a brand name or brand code to search.';
      return;
    }

    const importedBrand = this.loadBrandCatalog().find((brand) => {
      const codes = [brand.code, ...(brand.codes || [])].map((code) => this.normalize(code));
      const name = this.normalize(brand.brand);
      const combined = this.normalize(`${codes.join(' ')} ${brand.brand}`);
      return codes.some((code) => code === term || code.includes(term)) || name.includes(term) || combined.includes(term);
    });
    if (!importedBrand) {
      this.saveError = this.loadBrandCatalog().length
        ? 'Brand not found. Search using the imported brand code or name.'
        : 'No MRP brand catalog is loaded. Ask Admin to import the Excise Excel file first.';
      return;
    }
    const activeBrand = { name: importedBrand.brand, code: importedBrand.code };
    this.selectedBrand = activeBrand;
    this.loadExistingEntry(activeBrand);
    this.saveError = '';
  }
  async save() {
    if (this.isSaving) {
      return;
    }
    const savedSheets = JSON.parse(sessionStorage.getItem(this.daySheetStorageKey()) || '[]');
    const activeBrand = this.selectedBrand;
    const brandName = this.normalize(activeBrand.name);
    const brandCode = this.normalize(activeBrand.code);
    const isPlaceholderBrand = !brandName;

    if (isPlaceholderBrand) {
      this.saveError = 'Please search and select a valid brand before saving.';
      return;
    }

    const existingIndex = Array.isArray(savedSheets) ? savedSheets.findIndex((sheet) => {
      const savedBrand = this.normalize(sheet.brand);
      const savedCode = this.normalize(sheet.code);
      const sameBrand = savedBrand === brandName;
      const sameCode = brandCode !== 'searched' && savedCode === brandCode;
      return sameBrand || sameCode;
    }) : -1;

    this.saveError = '';
    this.isSaving = true;
    const updatedRecord = {
      brand: activeBrand.name,
      code: activeBrand.code,
      date: this.date,
      sizes: this.rows.map(row => ({ size: row.size, opening: 0, sales: row.bottles, closing: 0, price: row.price, amount: row.bottles * row.price })),
      difference: 0,
      remarks: ''
    };
    if (existingIndex >= 0) {
      savedSheets[existingIndex] = updatedRecord;
    } else {
      savedSheets.push(updatedRecord);
    }
    sessionStorage.setItem(this.daySheetStorageKey(), JSON.stringify(savedSheets));
    this.isSaving = false;
    this.router.navigate(['/day-sheet']);
  }

  private normalize(value: string) {
    return String(value || '').trim().toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9]+/g, '');
  }

  viewSheet() { this.router.navigate(['/day-sheet']); }

  cancelEntry() {
    this.router.navigate(['/sheet-date']);
  }

  private loadExistingEntry(brand: { name: string; code: string }) {
    const savedSheets = this.readSavedSheets();
    const existing = savedSheets.find((sheet) =>
      this.normalize(sheet.brand) === this.normalize(brand.name) ||
      (brand.code !== 'SEARCHED' && this.normalize(sheet.code) === this.normalize(brand.code))
    );
    if (!existing) {
      this.rows = this.createRowsFromCatalog(brand);
      return;
    }
    this.rows = (existing.sizes || []).map((size: any) => ({
      size: size.size,
      bottles: Number(size.sales ?? size.closing ?? 0),
      price: Number(size.price || 0)
    }));
  }

  private createRowsFromCatalog(brand: { name: string; code: string }) {
    const importedBrand = this.loadBrandCatalog().find((item) => item.code === brand.code);
    if (importedBrand?.sizes?.length) {
      return importedBrand.sizes.map((size: any) => ({ size: size.size, bottles: 0, price: Number(size.mrp || 0) }));
    }
    return [
      { size: '1000ml', bottles: 0, price: 950 },
      { size: '750ml', bottles: 0, price: 720 },
      { size: '375ml', bottles: 0, price: 380 },
      { size: '180ml', bottles: 0, price: 190 },
      { size: '90ml', bottles: 0, price: 100 }
    ];
  }

  private readSavedSheets(): any[] {
    try {
      const saved = JSON.parse(sessionStorage.getItem(this.daySheetStorageKey()) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  private loadBrandCatalog(): any[] {
    try {
      const saved = JSON.parse(localStorage.getItem('vinoledger.mrp.brands') || '[]');
      return Array.isArray(saved) ? this.mergeCatalogBrands(saved.map((brand) => this.normalizeCatalogBrand(brand))).filter((brand) => brand.code && brand.brand) : [];
    } catch {
      return [];
    }
  }

  private daySheetStorageKey() {
    return `vinoledger.daySheet.${this.normalize(String(this.shop.id || 'KKD41'))}`;
  }

  private normalizeCatalogBrand(brand: any) {
    let code = String(brand.code || '').trim();
    let name = String(brand.brand || '').trim();
    const combined = `${code} ${name}`.trim();
    const match = /^([A-Za-z0-9]+)\s*[-:]\s*(.+)$/.exec(combined) || /^([A-Za-z0-9]+)\s*[-:]\s*(.+)$/.exec(name);
    if (match) {
      code = match[1];
      name = match[2].trim();
    }
    return { ...brand, code, brand: name, codes: Array.from(new Set([code, ...(brand.codes || [])].filter(Boolean))) };
  }

  private mergeCatalogBrands(brands: any[]) {
    const merged = new Map<string, any>();
    brands.forEach((brand) => {
      const key = this.normalize(brand.brand);
      const current = merged.get(key) || { ...brand, codes: [] };
      current.codes = Array.from(new Set([...(current.codes || []), brand.code, ...(brand.codes || [])].filter(Boolean)));
      current.code = current.codes[0] || current.code;
      (brand.sizes || []).forEach((size: any) => {
        const existing = current.sizes.find((item: any) => item.size === size.size && item.sizeCode === size.sizeCode);
        if (existing) existing.mrp = size.mrp;
        else current.sizes.push({ ...size });
      });
      merged.set(key, current);
    });
    return Array.from(merged.values());
  }
}

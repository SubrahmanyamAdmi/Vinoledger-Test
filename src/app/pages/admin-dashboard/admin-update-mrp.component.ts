import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';

interface MRPBrand {
  brand: string;
  code: string;
  codes?: string[];
  category?: string;
  sizes: { size: string; sizeCode?: string; sizeMl?: number; mrp: number }[];
}

@Component({
  selector: 'app-admin-update-mrp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-update-mrp.component.html',
  styleUrls: ['./admin-update-mrp.component.scss']
})
export class AdminUpdateMrpComponent implements OnDestroy {
  search = '';
  isEditing = false;
  isSearching = false;
  showAddBrandForm = false;
  importMessage = '';
  importError = '';
  selectedBrandCode = '';
  selectedSizeName = '';
  newBrandCode = '';
  newBrandName = '';
  newSize = '';
  newMrp = 0;
  editingRowKey: string | null = null;
  private originalMrp: number[] = [];
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private rowEditOriginalMrp = 0;

  brands: MRPBrand[] = [
    {
      brand: 'Royal Stag',
      code: 'RS-104',
      sizes: [
        { size: '90ml', mrp: 180 },
        { size: '180ml', mrp: 350 },
        { size: '375ml', mrp: 690 },
        { size: '750ml', mrp: 1320 },
        { size: '1000ml', mrp: 1760 }
      ]
    },
    {
      brand: 'Black Dog',
      code: 'BD-208',
      sizes: [
        { size: '90ml', mrp: 220 },
        { size: '180ml', mrp: 420 },
        { size: '375ml', mrp: 820 },
        { size: '750ml', mrp: 1490 },
        { size: '1000ml', mrp: 1980 }
      ]
    },
    {
      brand: 'Jameson',
      code: 'JM-308',
      sizes: [
        { size: '90ml', mrp: 260 },
        { size: '180ml', mrp: 520 },
        { size: '375ml', mrp: 980 },
        { size: '750ml', mrp: 1850 },
        { size: '1000ml', mrp: 2450 }
      ]
    },
    {
      brand: 'Hennessy',
      code: 'HN-440',
      sizes: [
        { size: '90ml', mrp: 310 },
        { size: '180ml', mrp: 620 },
        { size: '375ml', mrp: 1180 },
        { size: '750ml', mrp: 2280 },
        { size: '1000ml', mrp: 2940 }
      ]
    }
  ];

  constructor(
    public auth: AuthService,
    private router: Router,
    private firestore: FirestoreService
  ) {
    this.loadStoredBrands();
  }

  importWorkbook(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importMessage = '';
    this.importError = '';
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const importedBrands = workbook.SheetNames.reduce((brands, sheetName) => {
          const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
          return this.mergeBrands([...brands, ...this.parseWorkbookMatrix(matrix)]);
        }, [] as MRPBrand[]);
        if (!importedBrands.length) {
          throw new Error('No valid brand rows found');
        }
        this.brands = this.mergeBrands(this.normalizeImportedBrands(importedBrands));
        await this.persistBrandCatalog();
        this.importMessage = `${this.brands.length} brands imported successfully.`;
      } catch {
          this.importError = 'Could not read the workbook. Check that it contains brand/code and size-specific MRP columns.';
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => { this.importError = 'Could not read the selected workbook.'; input.value = ''; };
    reader.readAsArrayBuffer(file);
  }

  get filteredBrands(): MRPBrand[] {
    if (!this.search.trim()) {
      return this.brands;
    }

    const term = this.normalizeSearch(this.search);
    return this.brands.filter((item) => {
      const labels = [
        item.brand,
        item.code,
        ...(item.codes || []),
        this.getBrandDisplayLabel(item)
      ];

      return labels.some((label) => this.normalizeSearch(label).includes(term));
    });
  }

  get mrpRows(): Array<{ brand: MRPBrand; size: MRPBrand['sizes'][number] }> {
    return this.filteredBrands.flatMap((brand) =>
      brand.sizes.map((size) => ({ brand, size }))
    );
  }

  get selectedBrand(): MRPBrand | undefined {
    return this.brands.find((brand) => brand.code === this.selectedBrandCode || (brand.codes || []).includes(this.selectedBrandCode));
  }

  getBrandDisplayLabel(brand: MRPBrand): string {
    return `${(brand.codes || [brand.code]).join(', ')} - ${brand.brand}`;
  }

  get selectedSizes() {
    return this.selectedBrand?.sizes || [];
  }

  get selectedSize() {
    return this.selectedSizes.find((size) => size.size === this.selectedSizeName);
  }

  onSearchChange() {
    this.isSearching = true;

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.applySearchSelection();
      this.isSearching = false;
    }, 150);
  }

  private applySearchSelection() {
    const normalizedSearch = this.normalizeSearch(this.search);
    const match = this.brands.find((brand) => {
      const labels = [brand.brand, brand.code, ...(brand.codes || []), this.getBrandDisplayLabel(brand)].map((value) => this.normalizeSearch(value));
      return labels.some((label) => label === normalizedSearch || label.includes(normalizedSearch));
    });

    if (match) {
      this.selectedBrandCode = match.code;
      this.selectedSizeName = match.sizes[0]?.size || '';
      return;
    }

    const first = this.filteredBrands[0];
    this.selectedBrandCode = first?.code || '';
    this.selectedSizeName = first?.sizes[0]?.size || '';
  }

  onBrandSelected() {
    this.selectedSizeName = this.selectedBrand?.sizes[0]?.size || '';
  }

  updateSelectedMrp() {
    if (!this.selectedSize || this.auth.userRole() !== 'Admin') return;
    localStorage.setItem('vinoledger.mrp.brands', JSON.stringify(this.brands));
    this.importMessage = `${this.selectedBrand?.brand} ${this.selectedSize.size} MRP updated.`;
  }

  toggleAddBrandForm() {
    this.showAddBrandForm = !this.showAddBrandForm;
    if (!this.showAddBrandForm) {
      this.cancelAddBrand();
    }
  }

  async submitNewBrand() {
    const brandCode = this.newBrandCode.trim();
    const brandName = this.newBrandName.trim();
    const size = this.newSize.trim();
    const mrp = Number(this.newMrp);

    if (!brandCode || !brandName || !size || !Number.isFinite(mrp)) {
      this.importError = 'Please enter Brand Code, Brand Name, Size, and MRP.';
      this.importMessage = '';
      return;
    }

    const existingBrand = this.brands.find((brand) =>
      this.normalizeSearch(brand.brand) === this.normalizeSearch(brandName) ||
      (brand.codes || []).some((code) => this.normalizeSearch(code) === this.normalizeSearch(brandCode))
    );

    if (existingBrand) {
      const existingSize = existingBrand.sizes.find((item) => this.normalizeSearch(item.size) === this.normalizeSearch(size));
      if (existingSize) {
        existingSize.mrp = mrp;
      } else {
        existingBrand.sizes.push({ size, sizeMl: this.parseSizeMl(size), mrp });
      }
      existingBrand.codes = Array.from(new Set([...(existingBrand.codes || []), brandCode]));
      existingBrand.code = existingBrand.codes[0] || brandCode;
    } else {
      this.brands.push({
        brand: brandName,
        code: brandCode,
        codes: [brandCode],
        sizes: [{ size, sizeMl: this.parseSizeMl(size), mrp }]
      });
    }

    await this.persistBrandCatalog();

    this.selectedBrandCode = brandCode;
    this.selectedSizeName = size;
    this.showAddBrandForm = false;
    this.importMessage = `${brandName} added successfully.`;
    this.importError = '';
    this.resetNewBrandForm();
  }

  cancelAddBrand() {
    this.resetNewBrandForm();
    this.importError = '';
  }

  private resetNewBrandForm() {
    this.newBrandCode = '';
    this.newBrandName = '';
    this.newSize = '';
    this.newMrp = 0;
  }

  setSelectedMrp(value: number) {
    if (this.selectedSize && this.auth.userRole() === 'Admin') {
      this.selectedSize.mrp = Number(value) || 0;
    }
  }

  get allSizes(): string[] {
    const sizes = this.brands.flatMap((brand) => brand.sizes.map((size) => size.size));
    return Array.from(new Set(sizes)).sort((a, b) => this.sizeValue(a) - this.sizeValue(b));
  }

  getMrp(brand: MRPBrand, sizeName: string) {
    return brand.sizes.find((size) => size.size === sizeName);
  }

  private sizeValue(size: string) {
    const value = Number(String(size).replace(/[^0-9.]/g, ''));
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  startEditing() {
    this.originalMrp = this.brands.flatMap((brand) => brand.sizes.map((size) => size.mrp));
    this.isEditing = true;
  }

  async updateValues() {
    this.isEditing = false;
    this.originalMrp = [];
    await this.persistBrandCatalog();
  }

  cancelEditing() {
    let valueIndex = 0;
    for (const brand of this.brands) {
      for (const size of brand.sizes) {
        size.mrp = this.originalMrp[valueIndex++];
      }
    }
    this.isEditing = false;
    this.originalMrp = [];
  }

  trackByBrandSize(index: number, row: { brand: MRPBrand; size: { size: string; sizeCode?: string; sizeMl?: number; mrp: number } }) {
    return `${row.brand.code}-${row.size.size}-${row.size.sizeCode || ''}`;
  }

  getRowKey(row: { brand: MRPBrand; size: { size: string; sizeCode?: string; sizeMl?: number; mrp: number } }): string {
    return `${row.brand.code}-${row.size.size}-${row.size.sizeCode || ''}`;
  }

  startRowEdit(row: { brand: MRPBrand; size: { size: string; sizeCode?: string; sizeMl?: number; mrp: number } }) {
    this.editingRowKey = this.getRowKey(row);
    this.rowEditOriginalMrp = Number(row.size.mrp || 0);
  }

  async saveRowEdit(row: { brand: MRPBrand; size: { size: string; sizeCode?: string; sizeMl?: number; mrp: number } }) {
    const validMrp = Number(row.size.mrp);
    row.size.mrp = Number.isFinite(validMrp) ? validMrp : this.rowEditOriginalMrp;
    this.editingRowKey = null;
    this.rowEditOriginalMrp = 0;
    await this.persistBrandCatalog();
    this.importMessage = `${row.brand.brand} ${row.size.size} MRP updated.`;
  }

  cancelRowEdit(row: { brand: MRPBrand; size: { size: string; sizeCode?: string; sizeMl?: number; mrp: number } }) {
    row.size.mrp = this.rowEditOriginalMrp;
    this.editingRowKey = null;
    this.rowEditOriginalMrp = 0;
  }

  goBack() {
    const role = this.auth.userRole();
    if (role === 'Admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/owner']);
    }
  }

  logout() {
    this.auth.logout();
  }

  ngOnDestroy() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  private async loadStoredBrands() {
    const saved = localStorage.getItem('vinoledger.mrp.brands');
    if (saved) {
      try {
        const imported = JSON.parse(saved);
        if (Array.isArray(imported) && imported.length) {
          this.brands = this.mergeBrands(this.normalizeImportedBrands(imported));
        }
      } catch {
        localStorage.removeItem('vinoledger.mrp.brands');
      }
    }

    if (this.isFirebaseConfigured()) {
      try {
        await this.ensureFirebaseAnonymousSession();
        const snapshot = await this.firestore.getDocumentOnce<{ brands: MRPBrand[] }>('mrpCatalog', 'brands');
        if (snapshot?.brands && Array.isArray(snapshot.brands) && snapshot.brands.length) {
          this.brands = this.mergeBrands(this.normalizeImportedBrands(snapshot.brands));
          localStorage.setItem('vinoledger.mrp.brands', JSON.stringify(this.brands));
        }
      } catch {
        // Ignore Firebase read failures and keep the local catalog loaded.
      }
    }
  }

  private async persistBrandCatalog() {
    this.brands = this.mergeBrands(this.normalizeImportedBrands(this.brands));
    localStorage.setItem('vinoledger.mrp.brands', JSON.stringify(this.brands));

    if (!this.isFirebaseConfigured()) {
      return;
    }

    try {
      await this.ensureFirebaseAnonymousSession();
      await this.firestore.setDocument('mrpCatalog', 'brands', { brands: this.brands });
      this.importError = '';
    } catch {
      this.importError = 'Saved locally, but Firebase sync failed.';
    }
  }

  private async ensureFirebaseAnonymousSession() {
    const auth = getAuth();
    if (auth.currentUser) {
      return;
    }

    await signInAnonymously(auth);
  }

  private isFirebaseConfigured() {
    const config = environment.firebaseConfig;
    return Boolean(
      config.apiKey &&
      config.appId &&
      config.projectId &&
      config.apiKey !== 'YOUR_API_KEY' &&
      config.projectId !== 'YOUR_PROJECT_ID'
    );
  }

  private parseWorkbookRows(rows: Record<string, unknown>[]): MRPBrand[] {
    const grouped = new Map<string, MRPBrand>();
    rows.forEach((row) => {
      const values = new Map(Object.entries(row).map(([key, value]) => [this.normalizeHeader(key), value]));
      const combinedBrandValue = String(this.findValue(values, ['brandcodebrandname', 'brandnumberbrandname', 'brandnamecode', 'brandcodename', 'brandcodeandname', 'brandnumberandbrandname', 'brandnumberbrandcode']) || '').trim();
      const brandCodeValue = String(this.findValue(values, ['brandcode', 'brandnumber', 'brandno', 'brandnum', 'productcode']) || '').trim();
      const brandNumberValue = String(this.findValue(values, ['brandnumber', 'brandno', 'brandnum']) || '').trim();
      const rawBrandName = String(this.findValue(values, ['brandname', 'productname', 'brand']) || '').trim();

      const resolvedBrand = this.resolveImportedBrandDetails(combinedBrandValue, rawBrandName, brandCodeValue, brandNumberValue);
      const normalizedCode = this.normalizeBrandCode(resolvedBrand.code || brandCodeValue || brandNumberValue || '');
      const brand = resolvedBrand.name || rawBrandName;

      const daySheetBrand = this.resolveBrandFromDaySheet(brand, normalizedCode);
      const finalBrandName = daySheetBrand?.brand || brand;
      const finalBrandCode = this.normalizeBrandCode(daySheetBrand?.code || normalizedCode || '');

      const sizeMl = this.parseSizeMl(this.findValue(values, ['sizeinml', 'sizeml', 'size', 'quantity']));
      const sizeCode = String(this.findValue(values, ['sizecode', 'sizeid']) || '').trim();
      const mrp = this.parseNumber(this.findValue(values, ['mrp', 'mrpvalue', 'maximumretailprice']));
      if (!finalBrandName || !finalBrandCode || !sizeMl || !Number.isFinite(mrp)) return;
      const key = this.normalizeSearch(finalBrandName);
      const current = grouped.get(key) || { brand: finalBrandName, code: finalBrandCode, codes: [], sizes: [] };
      current.codes = Array.from(new Set([...(current.codes || []), finalBrandCode]));
      current.code = current.codes[0] || finalBrandCode;
      const duplicate = current.sizes.find((size) => size.sizeMl === sizeMl && size.sizeCode === sizeCode);
      if (duplicate) duplicate.mrp = mrp;
      else current.sizes.push({ size: `${sizeMl}ml`, sizeCode, sizeMl, mrp });
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map((brand) => ({
      ...brand,
      sizes: brand.sizes.sort((a, b) => (a.sizeMl || 0) - (b.sizeMl || 0))
    }));
  }

  private parseWorkbookMatrix(matrix: unknown[][]): MRPBrand[] {
    const headerIndex = this.findHeaderIndex(matrix);
    if (headerIndex < 0) return [];

    const headerRow = matrix[headerIndex];
    const nextHeaderRow = matrix[headerIndex + 1] || [];
    const directHeaders = headerRow.map((cell) => this.normalizeHeader(String(cell)));
    const headers = headerRow.map((cell, index) => this.normalizeHeader(`${String(cell)} ${String(nextHeaderRow[index] || '')}`));
    const exactIndex = (names: string[]) => headers.findIndex((header) => names.includes(header));
    const containsIndex = (names: string[]) => headers.findIndex((header, index) =>
      names.some((name) => header.includes(name) || directHeaders[index].includes(name)));

    const exactCodeIndex = directHeaders.findIndex((header) => header === 'brandcode' || header === 'brandnumber' || header === 'brandno' || header === 'brandnum');
    const exactNameIndex = directHeaders.findIndex((header) => header === 'brandname' || header === 'productname' || header === 'brand');
    const exactSizeIndex = directHeaders.findIndex((header) => header === 'size' || header === 'sizeinml' || header === 'sizeml' || header === 'quantity' || header === 'packqtysize' || header === 'packqty');
    const exactMrpIndex = directHeaders.findIndex((header) => header === 'mrp' || header === 'mrpvalue' || header === 'maximumretailprice' || header === 'rate' || header === 'price');

    const combinedBrandIndex = exactIndex(['brandcodebrandname', 'brandnumberbrandname', 'brandnamecode', 'brandcodename', 'brandcodeandname', 'brandnumberandbrandname', 'brandnumberbrandcode']) ??
      containsIndex(['brandcodebrandname', 'brandnumberbrandname', 'brandnamecode', 'brandcodename', 'brandcodeandname', 'brandnumberandbrandname', 'brandnumberbrandcode']);
    const codeIndex = exactCodeIndex >= 0 ? exactCodeIndex :
      exactIndex(['brandcode', 'brandnumber', 'brandno', 'brandnum']) ??
      exactIndex(['productcode', 'code']) ??
      containsIndex(['brandcode', 'brandnumber', 'brandno', 'brandnum', 'productcode', 'code']);
    const nameIndex = exactNameIndex >= 0 ? exactNameIndex :
      exactIndex(['brandname', 'productname', 'brand']) ??
      containsIndex(['brandname', 'productname', 'brand']);
    const sizeIndex = exactSizeIndex >= 0 ? exactSizeIndex :
      exactIndex(['sizeinml', 'sizeml', 'size', 'quantity', 'packqtysize', 'packqty']) ??
      containsIndex(['sizeinml', 'sizeml', 'size', 'quantity', 'packqtysize', 'packqty']);
    const sizeCodeIndex = exactIndex(['sizecode', 'sizeid']) ?? containsIndex(['sizecode', 'sizeid']);
    const mrpIndex = exactMrpIndex >= 0 ? exactMrpIndex :
      exactIndex(['mrp', 'maximumretailprice', 'mrpvalue', 'rate', 'price']) ??
      containsIndex(['mrp', 'maximumretailprice', 'mrpvalue', 'rate', 'price']);

    const wideSizeColumns = headerRow
      .map((cell, index) => {
        const rawCell = String(cell || '').trim();
        const rawNextCell = String(nextHeaderRow[index] || '').trim();
        const normalizedCell = this.normalizeHeader(rawCell);
        const normalizedNextCell = this.normalizeHeader(rawNextCell);
        const sizeMl = this.extractSizeMl(rawCell) ?? this.extractSizeMl(rawNextCell);

        const isLikelySizeColumn =
          sizeMl !== null && (
            normalizedCell.includes('size') ||
            normalizedCell.includes('ml') ||
            normalizedCell.includes('litre') ||
            normalizedCell.includes('liter') ||
            normalizedCell.includes('pack') ||
            normalizedCell.includes('qty') ||
            normalizedNextCell.includes('mrp') ||
            normalizedNextCell.includes('maximumretailprice') ||
            normalizedNextCell.includes('rate') ||
            normalizedNextCell.includes('price')
          );

        return isLikelySizeColumn ? { index, sizeMl } : null;
      })
      .filter((column): column is { index: number; sizeMl: number } => column !== null);

    const rows: Record<string, unknown>[] = matrix.slice(headerIndex + 1).map((row) => ({
      brandCode: codeIndex >= 0 ? row[codeIndex] ?? '' : '',
      brandName: nameIndex >= 0 ? row[nameIndex] ?? '' : '',
      brandCodeBrandName: combinedBrandIndex >= 0 ? row[combinedBrandIndex] ?? '' : '',
      sizeInMl: row[sizeIndex] ?? '',
      sizeCode: row[sizeCodeIndex] ?? '',
      mrp: row[mrpIndex] ?? ''
    }));

    const parsed = this.parseWorkbookRows(rows);
    if (parsed.length) return parsed;

    if (wideSizeColumns.length) {
      const wideRows: Record<string, unknown>[] = [];
      matrix.slice(headerIndex + 1).forEach((row) => {
        const brandCodeBrandName = combinedBrandIndex >= 0 ? row[combinedBrandIndex] ?? '' : '';
        const brandCode = codeIndex >= 0 ? row[codeIndex] ?? '' : '';
        const brandName = nameIndex >= 0 ? row[nameIndex] ?? '' : '';
        wideSizeColumns.forEach(({ index, sizeMl }) => {
          const mrp = row[index];
          if (mrp === '' || mrp === null || mrp === undefined) return;
          wideRows.push({ brandCode, brandName, brandCodeBrandName, sizeInMl: sizeMl, mrp });
        });
      });
      return this.parseWorkbookRows(wideRows);
    }

    return [];
  }

  private findHeaderIndex(matrix: unknown[][]): number {
    let bestIndex = -1;
    let bestScore = 0;

    matrix.forEach((row, index) => {
      const normalized = row.map((cell) => this.normalizeHeader(String(cell)));
      const score =
        (normalized.some((cell) => cell.includes('brand') || cell.includes('product') || cell.includes('code')) ? 1 : 0) +
        (normalized.some((cell) => cell.includes('size') || cell.includes('qty') || cell.includes('pack') || cell.includes('ml') || cell.includes('litre') || cell.includes('liter')) ? 1 : 0) +
        (normalized.some((cell) => cell.includes('mrp') || cell.includes('price') || cell.includes('rate')) ? 1 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestScore >= 2 ? bestIndex : -1;
  }

  private extractSizeMl(header: string): number | null {
    const match = /(?:^|[^0-9])([0-9]+(?:[.][0-9]+)?)(?:ml)?(?:[^0-9]|$)/.exec(header);
    if (!match) return null;
    const sizeMl = Number(match[1]);
    return Number.isFinite(sizeMl) && sizeMl > 0 ? sizeMl : null;
  }

  private parseSizeMl(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const match = /[0-9]+(?:[.,][0-9]+)?/.exec(String(value || '').replace(/,/g, ''));
    return match ? Number(match[0].replace(',', '.')) : 0;
  }

  private parseNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    const normalized = String(value || '').replace(/[^0-9.-]/g, '');
    return Number(normalized);
  }

  private findValue(values: Map<string, unknown>, candidates: string[]) {
    for (const candidate of candidates) {
      if (values.has(candidate)) return values.get(candidate);
    }
    return '';
  }

  private resolveImportedBrandDetails(combinedBrandValue: string, rawBrandName: string, brandCodeValue: string, brandNumberValue: string) {
    const directCode = this.normalizeBrandCode(brandCodeValue || brandNumberValue || '');
    const brandName = rawBrandName || this.extractBrandName(combinedBrandValue, directCode);
    const combinedBrandName = this.extractBrandName(combinedBrandValue, directCode);

    return {
      name: brandName || combinedBrandName,
      code: directCode || this.extractBrandCode(combinedBrandValue) || this.extractBrandCode(brandCodeValue) || this.extractBrandCode(brandNumberValue)
    };
  }

  private normalizeBrandCode(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    const extracted = this.extractBrandCode(trimmed);
    if (extracted) return extracted;

    if (/^[0-9]+$/.test(trimmed.replace(/[^0-9]/g, '')) && trimmed.replace(/[^0-9]/g, '').length) {
      return trimmed.replace(/[^0-9]/g, '');
    }

    return trimmed;
  }

  private extractBrandName(value: string, code: string): string {
    const text = String(value || '').trim();
    if (!text) return '';

    const candidateCode = code || this.extractBrandCode(text);
    if (candidateCode) {
      const cleaned = text
        .replace(new RegExp(candidateCode, 'gi'), '')
        .replace(/[-:/|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned) return cleaned;
    }

    return text;
  }

  private normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private isBrandCode(candidate: string): boolean {
    return /^[A-Za-z][0-9]{3}$/.test(candidate.trim());
  }

  private extractBrandCode(value: string): string {
    const text = String(value || '');
    const match = text.match(/[A-Za-z][0-9]{3}/g)?.find((code) => this.isBrandCode(code));
    return match || '';
  }

  private normalizeImportedBrands(brands: MRPBrand[]): MRPBrand[] {
    return brands.map((brand) => {
      const code = this.isBrandCode(String(brand.code || '').trim())
        ? String(brand.code || '').trim()
        : this.extractBrandCode(String(brand.code || '')) || String(brand.code || '').trim();
      const codes = Array.from(new Set([code, ...(brand.codes || []).map((item) => this.isBrandCode(String(item || '').trim())
        ? String(item || '').trim()
        : this.extractBrandCode(String(item || '')) || String(item || '').trim())].filter(Boolean)));
      return { ...brand, code, codes };
    });
  }

  private resolveBrandFromDaySheet(brand: string, code: string): { brand: string; code: string } | null {
    const daySheetBrandList = this.getDaySheetBrandList();
    const normalizedBrand = this.normalizeSearch(brand);
    const normalizedCode = this.normalizeSearch(code);

    const exactBrandMatch = daySheetBrandList.find((entry) => this.normalizeSearch(entry.brand) === normalizedBrand);
    if (exactBrandMatch) {
      return { brand: exactBrandMatch.brand, code: exactBrandMatch.code };
    }

    if (normalizedCode) {
      const exactCodeMatch = daySheetBrandList.find((entry) => this.normalizeSearch(entry.code) === normalizedCode);
      if (exactCodeMatch) {
        return { brand: exactCodeMatch.brand, code: exactCodeMatch.code };
      }
    }

    return null;
  }

  private getDaySheetBrandList(): Array<{ brand: string; code: string }> {
    const entries: Array<{ brand: string; code: string }> = [];
    const sources = [
      localStorage.getItem('vinoledger.daySheetSubmissions'),
      localStorage.getItem('vinoledger.daySheetSubmission'),
      sessionStorage.getItem('vinoledger.daySheetSubmission')
    ];

    sources.forEach((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const submissions = Array.isArray(parsed) ? parsed : [parsed];

        submissions.forEach((submission: any) => {
          const records = Array.isArray(submission?.records) ? submission.records : [];
          records.forEach((record: any) => {
            if (!record?.brand || !record?.code) return;
            entries.push({ brand: String(record.brand).trim(), code: String(record.code).trim() });
          });
        });
      } catch {
        // Ignore malformed saved local data.
      }
    });

    return entries.filter((entry, index, array) =>
      entry.brand && entry.code && index === array.findIndex((other) =>
        this.normalizeSearch(other.brand) === this.normalizeSearch(entry.brand) &&
        this.normalizeSearch(other.code) === this.normalizeSearch(entry.code)
      )
    );
  }

  private normalizeSearch(value: string) {
    return String(value || '').toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9]+/g, '');
  }

  private mergeBrands(brands: MRPBrand[]): MRPBrand[] {
    const merged = new Map<string, MRPBrand>();
    brands.forEach((raw) => {
      const brand = String(raw.brand || '').trim();
      if (!brand) return;
      const key = this.normalizeSearch(brand);
      const current = merged.get(key) || { brand, code: raw.code || '', codes: [], category: raw.category, sizes: [] };
      current.codes = Array.from(new Set([...(current.codes || []), raw.code, ...(raw.codes || [])].filter(Boolean)));
      current.code = current.codes[0] || current.code;
      current.category = current.category || raw.category;
      (raw.sizes || []).forEach((incoming) => {
        const existing = current.sizes.find((size) => size.size === incoming.size && size.sizeCode === incoming.sizeCode);
        if (existing) existing.mrp = incoming.mrp;
        else current.sizes.push({ ...incoming });
      });
      merged.set(key, current);
    });
    return Array.from(merged.values());
  }
}

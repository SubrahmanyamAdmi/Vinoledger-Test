import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import { MrpCatalogService } from '../../services/mrp-catalog.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { AppLoaderComponent } from '../../shared/loader/app-loader.component';
import { AppSelectComponent, AppSelectOption } from '../../shared/select/select.component';

type BrandSize = { size: number; bottlesPerCase: number; mrp: number };
type BrandOption = { code: string; brand: string; sizes: BrandSize[]; aliases: string[] };
type OpeningStockRow = {
  code: string;
  displayCode?: string;
  brand: string;
  productType: string;
  size: number;
  cases: number;
  bottles: number;
  prtDelivered: number;
  bottlesPerCase: number;
  mrp: number;
  isExistingBrand: boolean;
  sizeOptions: BrandSize[];
  customSize: string;
  previousSize: number;
};

@Component({
  selector: 'app-opening-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, AppLoaderComponent, AppSelectComponent],
  templateUrl: './opening-stock.component.html',
  styleUrls: ['./opening-stock.component.scss']
})
export class OpeningStockComponent implements OnInit {
  shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{"id":"KKD41","owner":"Y Bathalaswamy"}');
  rows: OpeningStockRow[] = [];
  searchTerm = '';
  searchResults: BrandOption[] = [];
  confirmationOpen = false;
  isSaving = false;
  isCheckingAccess = true;
  status: 'draftSaved' | 'success' | 'error' | 'warning' | null = null;
  statusMessage = '';
  warningMessage = '';
  readonly submissionRules = [
    'Check brand code, brand name, size, quantity, and MRP.',
    'Duplicate brand code + name + size rows are not allowed.',
    'Units per case comes from the MRP list; missing values count as 0.'
  ];
  private brandOptionsCache: BrandOption[] | null = null;
  private catalogSync: Promise<void>;

  getSizeOptions(row: OpeningStockRow): AppSelectOption[] {
    return row.sizeOptions.map((option) => ({ value: option.size, label: `${option.size} ml` }));
  }

  constructor(
    public auth: AuthService,
    private router: Router,
    private businessData: BusinessDataService,
    private mrpCatalog: MrpCatalogService
  ) {
    this.catalogSync = this.syncMrpCatalogFromFirebase().then(() => {
      this.brandOptionsCache = null;
    });
  }

  async ngOnInit() {
    if (await this.canAccessOpeningStock()) {
      await this.catalogSync;
      await this.restoreDraft();
      this.isCheckingAccess = false;
      return;
    }
    this.router.navigateByUrl('/sheet-date');
  }

  goBack() {
    this.router.navigateByUrl('/sheet-date');
  }

  update(row: OpeningStockRow) {
    row.bottles = Math.max(0, Number(row.cases) || 0) * Math.max(0, Number(row.bottlesPerCase) || 0)
      + Math.max(0, Number(row.prtDelivered) || 0);
  }

  removeRow(index: number) {
    this.rows.splice(index, 1);
  }

  addSizeRow(row: OpeningStockRow) {
    const nextSize = row.sizeOptions.find((option) => !this.hasBrandSizeDuplicate({ ...row, size: option.size }));
    if (!nextSize) {
      this.warningMessage = `${row.brand} already has all available sizes.`;
      return;
    }
    const nextRow = this.createRow(row.code, row.brand);
    nextRow.displayCode = row.displayCode;
    nextRow.productType = row.productType || this.productTypeForBrand(row.brand);
    nextRow.isExistingBrand = row.isExistingBrand;
    nextRow.sizeOptions = [...row.sizeOptions];
    nextRow.size = nextSize?.size || row.size;
    nextRow.previousSize = nextRow.size;
    nextRow.bottlesPerCase = nextSize?.bottlesPerCase || 0;
    nextRow.mrp = nextSize?.mrp || 0;
    this.update(nextRow);
    const lastBrandRowIndex = this.rows.reduce((lastIndex, existing, index) =>
      this.sameBrand(existing, row) ? index : lastIndex, -1);
    this.rows.splice(lastBrandRowIndex + 1, 0, nextRow);
  }

  addBrandFromSearch() {
    this.warningMessage = '';
    const term = this.searchTerm.trim();
    const search = this.normalize(term);
    const searchCode = this.normalizeCode(term.split('-')[0]);
    if (search.length < 3) {
      return;
    }
    const matches = this.searchBrandOptions(search, searchCode);
    const option = this.loadExactStoredBrand(searchCode) || matches[0];
    console.log('[OpeningStock] brand search result', {
      term,
      normalizedSearch: search,
      normalizedCode: searchCode,
      results: matches.map((match) => ({ code: match.code, brand: match.brand })),
      result: option ? { code: option.code, brand: option.brand } : null
    });
    if (!option) {
      this.warningMessage = 'Select a brand from the search results before adding.';
      this.searchResults = [];
      return;
    }
    if (matches.length > 1 && this.brandSearchScore(option, search, searchCode) < 90) {
      this.searchResults = matches;
      return;
    }
    const row = this.createRow(option.code, option.brand);
    if (this.rows.some((existing) => this.sameBrand(existing, row))) {
      this.showValidationWarning([`${row.brand} is already added. Use the add-size button on its existing row to add another size.`]);
      return;
    }
    row.isExistingBrand = !!option;
    row.displayCode = option ? this.displayCodeForSearch(option, searchCode) : undefined;
    row.productType = this.productTypeForBrand(row.brand);
    row.sizeOptions = option?.sizes.length ? [...option.sizes] : [{ size: 750, bottlesPerCase: 0, mrp: 0 }];
    const defaultSize = row.sizeOptions[0];
    row.size = defaultSize?.size || 750;
    row.previousSize = row.size;
    row.bottlesPerCase = defaultSize?.bottlesPerCase || 0;
    row.mrp = defaultSize?.mrp || 0;
    this.update(row);
    this.rows.unshift(row);
    this.searchTerm = '';
    this.searchResults = [];
  }

  searchChanged(value: string) {
    const search = this.normalize(value);
    const searchCode = this.normalizeCode(value.split('-')[0]);
    if (search.length < 3) {
      this.searchResults = [];
      return;
    }
    const exactOption = this.loadExactStoredBrand(searchCode);
    this.searchResults = exactOption ? [exactOption] : this.searchBrandOptions(search, searchCode);
  }

  selectSearchResult(option: BrandOption) {
    this.searchTerm = this.searchResultCode(option);
    this.addBrandFromSearch();
  }

  searchResultCode(option: BrandOption) {
    const searchCode = this.normalizeCode(this.searchTerm.split('-')[0]);
    const matchingAlias = option.aliases.find((alias) => this.normalizeCode(alias).startsWith(searchCode));
    if (matchingAlias) {
      return matchingAlias;
    }
    const isCodeSearch = /^[a-z]+\d/.test(searchCode);
    return isCodeSearch
      ? option.code
      : option.aliases.find((alias) => /^c\d/i.test(String(alias).trim())) || option.code;
  }

  searchResultDetails(option: BrandOption) {
    const sizes = option.sizes.slice(0, 3).map((size) => {
      const units = size.bottlesPerCase ? `${size.bottlesPerCase} units/case` : 'units/case not set';
      return `${size.size} ml · ${units}`;
    });
    const remaining = option.sizes.length - sizes.length;
    return `${sizes.join('  |  ')}${remaining > 0 ? `  |  +${remaining} sizes` : ''}` || 'Size details unavailable';
  }

  get totalCases() {
    return this.rows.reduce((total, row) => total + Math.max(0, Number(row.cases) || 0), 0);
  }

  get totalBottles() {
    return this.rows.reduce((total, row) => total + Math.max(0, Number(row.bottles) || 0), 0);
  }

  get availableBrands() {
    if (!this.brandOptionsCache) {
      this.brandOptionsCache = this.loadBrandOptions();
    }
    return this.brandOptionsCache;
  }

  get statusMessages(): string[] {
    return this.statusMessage.split('\n').map((message) => message.trim()).filter(Boolean);
  }

  sizeChanged(row: OpeningStockRow) {
    const duplicate = this.hasBrandSizeDuplicate(row, row);
    if (duplicate) {
      row.size = row.previousSize;
      this.showValidationWarning([`${row.code} - ${row.brand} at ${row.previousSize} ml is already in the table.`]);
      return;
    }
    const selected = row.sizeOptions.find((option) => option.size === Number(row.size));
    if (selected) {
      row.bottlesPerCase = Number(selected.bottlesPerCase) || 0;
      row.mrp = Number(selected.mrp) || 0;
      row.previousSize = Number(row.size);
    }
    this.update(row);
  }

  brandDisplay(row: OpeningStockRow) {
    const code = row.displayCode || row.code;
    return code && row.brand ? `${code} - ${row.brand}` : code || row.brand;
  }

  async saveDraft() {
    if (this.isSaving) return;
    const rows = this.rows.filter((row) => row.code && row.brand);
    if (!rows.length) {
      this.showValidationWarning(['Add at least one brand before saving a draft.']);
      return;
    }
    const duplicates = this.duplicateBrandSizeMessages(rows);
    if (duplicates.length) {
      this.showValidationWarning(duplicates);
      return;
    }
    if (!(await this.canAccessOpeningStock())) {
      this.showValidationWarning(['Opening stock can only be edited before the opening-date day sheet is submitted.']);
      return;
    }

    this.isSaving = true;
    this.status = null;
    this.statusMessage = '';
    try {
      await this.businessData.saveOpeningStock(this.buildRecord(this.rows.filter((row) => row.code && row.brand)), 'draft');
      this.status = 'draftSaved';
    } catch (error) {
      this.status = 'error';
      this.statusMessage = error instanceof Error ? error.message : 'Unable to save opening stock draft.';
    } finally {
      this.isSaving = false;
    }
  }

  async submit() {
    const validationMessages = await this.validateSubmission();
    if (validationMessages.length) {
      this.showValidationWarning(validationMessages);
      return;
    }
    this.status = null;
    this.statusMessage = '';
    this.confirmationOpen = true;
  }

  cancelConfirmation() {
    this.confirmationOpen = false;
  }

  async confirmSave() {
    if (this.isSaving) {
      return;
    }
    const validationMessages = await this.validateSubmission();
    if (validationMessages.length) {
      this.confirmationOpen = false;
      this.showValidationWarning(validationMessages);
      return;
    }
    this.confirmationOpen = false;
    const validRows = this.rows.filter((row) => row.code && row.brand
      && (Number(row.cases) > 0 || Number(row.prtDelivered) > 0) && Number(row.size) > 0);
    this.status = null;
    this.statusMessage = '';

    this.isSaving = true;
    try {
      await this.businessData.saveOpeningStock(this.buildRecord(validRows), 'submitted');
      this.status = 'success';
    } catch (error) {
      this.status = 'error';
      this.statusMessage = error instanceof Error ? error.message : 'Unable to save opening stock.';
    } finally {
      this.isSaving = false;
    }
  }

  close() {
    const wasSuccess = this.status === 'success';
    this.status = null;
    this.statusMessage = '';
    if (wasSuccess) {
      this.router.navigateByUrl('/sheet-date');
    }
  }

  private async validateSubmission(): Promise<string[]> {
    const rows = this.rows.filter((row) => row.code && row.brand);
    if (!rows.length) {
      return ['Add at least one brand before submitting.'];
    }

    const messages = this.duplicateBrandSizeMessages(rows);
    const rowsWithStock = rows.filter((row) => Number(row.cases) > 0 || Number(row.prtDelivered) > 0);
    if (!rowsWithStock.length) {
      messages.push('Enter a case quantity or delivered bottles for at least one brand.');
    }

    const invalidMrp = rowsWithStock.filter((row) => Number(row.size) <= 0 || Number(row.mrp) <= 0);
    if (invalidMrp.length) {
      messages.push(`A valid size and MRP are required for: ${invalidMrp.map((row) => `${row.code} - ${row.brand} (${row.size} ml)`).join(', ')}.`);
    }

    if (messages.length) return messages;
    if (!(await this.canAccessOpeningStock())) {
      messages.push('Opening stock can be submitted only once and only before the opening-date day sheet is submitted.');
    }
    return messages;
  }

  private duplicateBrandSizeMessages(rows: OpeningStockRow[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    rows.forEach((row) => {
      const key = `${this.normalizeCode(row.code)}|${this.normalize(row.brand)}|${Number(row.size) || 0}`;
      if (seen.has(key)) {
        duplicates.add(`${row.code} - ${row.brand} (${row.size} ml)`);
      }
      seen.add(key);
    });
    return duplicates.size
      ? [`Duplicate brand code, brand name, and size: ${Array.from(duplicates).join(', ')}. Remove the duplicate row before continuing.`]
      : [];
  }

  private hasBrandSizeDuplicate(row: OpeningStockRow, exclude?: OpeningStockRow): boolean {
    const code = this.normalizeCode(row.code);
    const brand = this.normalize(row.brand);
    const size = Number(row.size) || 0;
    return this.rows.some((existing) => existing !== exclude
      && this.normalizeCode(existing.code) === code
      && this.normalize(existing.brand) === brand
      && Number(existing.size) === size);
  }

  private showValidationWarning(messages: string[]) {
    this.status = 'warning';
    this.statusMessage = messages.join('\n');
  }

  private buildRecord(rows: OpeningStockRow[]) {
    return {
      shopId: String(this.shop.id || ''),
      date: this.shop.openingDate || new Date().toISOString().slice(0, 10),
      submittedByName: this.auth.currentUser()?.name || 'Cashier',
      rows: rows.map((row) => ({
        code: row.displayCode || row.code,
        brand: row.brand,
        productType: row.productType,
        size: row.size,
        cases: row.cases,
        bottlesPerCase: row.bottlesPerCase,
        prtDelivered: row.prtDelivered,
        bottles: row.bottles,
        mrp: row.mrp,
      })),
    };
  }

  private async restoreDraft() {
    const record = await this.businessData.getOpeningStock(String(this.shop.id || ''));
    if (record?.status !== 'draft' || !Array.isArray(record.rows)) return;

    this.rows = record.rows.map((saved: any) => {
      const code = String(saved.code || '');
      const brand = String(saved.brand || '');
      const size = Number(saved.size) || 750;
      const option = this.availableBrands.find((item) =>
        this.normalizeCode(item.code) === this.normalizeCode(code)
        || this.normalize(item.brand) === this.normalize(brand)
        || item.aliases.some((alias) => this.normalizeCode(alias) === this.normalizeCode(code))
      );
      const sizeOptions = [...(option?.sizes || [])];
      const catalogSize = option?.sizes.find((item) => item.size === size);
      if (!sizeOptions.some((item) => item.size === size)) {
        sizeOptions.push({
          size,
          bottlesPerCase: Number(saved.bottlesPerCase) || 0,
          mrp: Number(saved.mrp) || 0,
        });
      }
      return {
        ...this.createRow(code, brand),
        displayCode: code,
        productType: String(saved.productType || ''),
        size,
        cases: Number(saved.cases) || 0,
        bottles: Number(saved.bottles) || 0,
        prtDelivered: Number(saved.prtDelivered) || 0,
        bottlesPerCase: Number(saved.bottlesPerCase) || catalogSize?.bottlesPerCase || 0,
        mrp: Number(saved.mrp) || catalogSize?.mrp || 0,
        isExistingBrand: !!option,
        sizeOptions,
        previousSize: size,
      };
    });
  }

  private createRow(code: string, brand: string): OpeningStockRow {
    return {
      code, brand, productType: '', size: 750, cases: 0, bottles: 0, prtDelivered: 0,
      bottlesPerCase: 0, mrp: 0, isExistingBrand: false, sizeOptions: [{ size: 750, bottlesPerCase: 0, mrp: 0 }], customSize: '', previousSize: 750
    };
  }

  private async canAccessOpeningStock(): Promise<boolean> {
    const user = this.auth.currentUser();
    const shopId = String(user?.role === 'User' ? user.shopId : this.shop.id || user?.shopId || '').trim();
    if (!shopId) {
      return false;
    }

    try {
      const [shops, openingStock, daySheets] = await Promise.all([
        firstValueFrom(this.businessData.getShops()),
        this.businessData.getOpeningStock(shopId),
        firstValueFrom(this.businessData.getDaySheets()),
      ]);
      const databaseShop = shops.find((shop: any) =>
        String(shop.shopId || shop.id || '').trim().toUpperCase() === shopId.toUpperCase()
      ) as any;
      const cachedShopId = String(this.shop.shopId || this.shop.id || '').trim();
      const cachedOpeningDate = cachedShopId.toUpperCase() === shopId.toUpperCase()
        ? this.shop.openingDate || this.shop.createdAt
        : '';
      this.shop = {
        ...this.shop,
        ...databaseShop,
        id: databaseShop?.shopId || databaseShop?.id || shopId,
        openingDate: databaseShop?.openingDate || databaseShop?.createdAt || cachedOpeningDate,
      };
      sessionStorage.setItem('vinoledger.shop', JSON.stringify(this.shop));

      const today = new Date();
      const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const storedOpeningDate = String(this.shop.openingDate || '').slice(0, 10);
      const openingDate = /^\d{4}-\d{2}-\d{2}$/.test(storedOpeningDate) && storedOpeningDate <= todayValue
        ? storedOpeningDate
        : todayValue;
      const openingDateSubmitted = daySheets.some((sheet) =>
        String(sheet.shopId || '').trim().toUpperCase() === shopId.toUpperCase()
        && String(sheet.date || '').slice(0, 10) === openingDate
      ) || this.readLocallySubmittedDates(shopId).includes(openingDate);

      return (!openingStock || openingStock.status === 'draft') && !openingDateSubmitted;
    } catch {
      return false;
    }
  }

  private readLocallySubmittedDates(shopId: string): string[] {
    try {
      const submitted = JSON.parse(localStorage.getItem('vinoledger.submittedDates') || '{}');
      const key = Object.keys(submitted).find((value) => value.toUpperCase() === shopId.toUpperCase());
      const dates = key ? submitted[key] : [];
      return Array.isArray(dates) ? dates.map((value: string) => String(value).slice(0, 10)) : [];
    } catch {
      return [];
    }
  }

  private loadBrandOptions(): BrandOption[] {
    const options = new Map<string, BrandOption>();
    const add = (code: string, brand: string, size: number, bottlesPerCase: number, mrp = 0, aliases: string[] = []) => {
      if (!brand || !size) return;
      const incomingCodes = [code, ...aliases].map((value) => this.normalize(String(value || ''))).filter(Boolean);
      const key = this.normalize(code) || this.normalize(brand);
      const existingEntry = Array.from(options.entries()).find(([, item]) => {
        const existingCodes = [item.code, ...item.aliases].map((value) => this.normalize(value));
        return this.normalize(item.brand) === this.normalize(brand)
          || incomingCodes.some((incomingCode) => existingCodes.includes(incomingCode));
      });
      const current = existingEntry?.[1] || { code, brand, sizes: [], aliases: [] };
      const currentKey = existingEntry?.[0] || key;
      current.code = code || current.code;
      current.brand = brand || current.brand;
      current.aliases = Array.from(new Set([...current.aliases, ...aliases, current.code]));
      const existingSize = current.sizes.find((item) => item.size === size);
      if (existingSize) {
        existingSize.bottlesPerCase = bottlesPerCase || existingSize.bottlesPerCase;
        existingSize.mrp = mrp || existingSize.mrp;
      } else {
        current.sizes.push({ size, bottlesPerCase, mrp });
      }
      options.delete(currentKey);
      options.set(this.normalize(current.code) || currentKey, current);
    };

    add('C021', 'BUDWEISER MAGNUM BEER', 650, 12);
    add('C029', 'KALYANI BLACK LABEL STRONG BEER', 650, 12);
    add('C031', 'KARJURA XTRA STRONG BEER', 650, 12);
    add('C038', 'KINGFISHER SPLENDID STRONG BEER', 650, 12);
    add('C040', 'KINGFISHER STORM REGAL STRONG BEER', 650, 12);
    add('C889', 'KINGFISHER ULTRA MAX PREMIUM FINE STRONG BEER', 650, 12);
    add('C043', 'KINGFISHER ULTRA SUPER PREMIUM LAGER BEER', 650, 12);
    add('C867', 'STOK STRONG FINE BEER', 500, 24);
    add('C226', 'AC BLACK CLASSIC WHISKY', 180, 48);
    add('C232', 'ALL SEASONS DOUBLE BARREL COLLECTION RESERVE WHISKY', 750, 12);
    add('C232', 'ALL SEASONS DOUBLE BARREL COLLECTION RESERVE WHISKY', 375, 24);
    add('C248', 'Aristocrat Premium Superior Whisky', 375, 24);
    add('C855', 'BACARDI PLATINUM + ORANGE', 275, 24);
    add('C260', 'BAGPIPER GOLD RESERVE WHISKY', 180, 48);
    add('C345', "GRAYSON'S SILVER STRIPES ORIGINAL RESERVE WHISKY", 180, 48);
    add('C900', 'HAPPY DAYS WHISKY', 180, 48);
    add('C844', 'ICONIQ WHITE SUPREME INTERNATIONAL GRAIN WHISKY', 180, 48);
    add('C844', 'ICONIQ WHITE SUPREME INTERNATIONAL GRAIN WHISKY', 90, 96);
    add('C844', 'ICONIQ WHITE SUPREME INTERNATIONAL GRAIN WHISKY', 375, 24);
    add('C707', 'KYRA PREMIUM RED WINE', 180, 48);
    add('C393', 'MAGIC MOMENTS REMIX GREEN APPLE PREMIUM FLAVOURED VODKA', 180, 48);
    add('C427', 'MORPHEUS BLUE XO PREMIUM BRANDY', 180, 48);
    add('C843', "OFFICER'S CHOICE ELEGANT WHISKY", 750, 12);
    add('C843', "OFFICER'S CHOICE ELEGANT WHISKY", 90, 96);
    add('C538', "SEAGRAM'S IMPERIAL BLUE SELECT GRAIN WHISKY", 375, 24);
    add('C538', "SEAGRAM'S IMPERIAL BLUE SELECT GRAIN WHISKY", 180, 48);
    add('C856', "SEAGRAM'S ROYAL STAG BARREL SELECT PREMIER WHISKY", 180, 48);
    add('C542', "SEAGRAM'S ROYAL STAG RESERVE WHISKY", 375, 24);
    add('C546', 'SHOT WHISKY', 180, 48);
    add('C565', "SIRI'S SENTINI SPECIAL DELUXE GRAIN WHISKY", 180, 48);
    add('C591', 'STERLING RESERVE B7 CLASSIC FINE BLENDED WHISKY', 180, 48);
    add('C848', 'TI MANSION HOUSE PLATINUM FRENCH BRANDY', 375, 24);
    add('C848', 'TI MANSION HOUSE PLATINUM FRENCH BRANDY', 180, 48);

    try {
      const activeShopId = String(this.shop?.id || this.auth.currentUser()?.shopId || '').trim();
      const shopKeys = activeShopId ? [
        `vinoledger.mrp.brands.${activeShopId}`,
        `vinoledger.mrp.brands.${activeShopId.toUpperCase()}`,
        `vinoledger.mrp.brands.${activeShopId.toLowerCase()}`
      ] : [];
      const globalKeys = ['vinoledger.mrp.brands.global', 'vinoledger.mrp.brands'];
      const scannedKeys = Object.keys(localStorage)
        .filter((key) => key.startsWith('vinoledger.mrp.brands.'))
        .filter((key) => !shopKeys.includes(key) && !globalKeys.includes(key));
      const orderedKeys = [...globalKeys, ...shopKeys, ...scannedKeys];

      orderedKeys.forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const brands = JSON.parse(raw);
          if (!Array.isArray(brands)) return;
          brands.forEach((item: any) => (item.sizes || []).forEach((size: any) => add(
            String(item.code || ''),
            String(item.brand || ''),
            this.parseSize(size.sizeMl ?? size.size),
            this.unitsPerCaseFromCatalog(size),
            Number(size.mrp ?? size.mrpValue ?? size.price ?? 0),
            item.codes || []
          )));
        } catch {
          // Ignore malformed catalog entries and continue.
        }
      });
    } catch {
      // Keep opening stock entry available when catalog data is malformed.
    }

    try {
      const invoices = JSON.parse(localStorage.getItem('vinoledger.invoices') || '[]');
      invoices.forEach((invoice: any) => (invoice.rows || []).forEach((row: any) => add(
        String(row.code || ''), String(row.brand || ''), Number(row.size || 0), Number(row.bottlesPerCase || 0)
      )));
    } catch {
      // Ignore malformed invoice history.
    }
    try {
      const settings = JSON.parse(localStorage.getItem(`vinoledger.invoice.brand-settings.${this.shop.id}`) || '[]');
      settings.forEach((setting: any) => add(
        String(setting.code || ''), String(setting.brand || ''), Number(setting.size || 0), Number(setting.bottlesPerCase || 0)
      ));
    } catch {
      // Ignore malformed brand settings.
    }

    return Array.from(options.values()).map((option) => ({
      ...option,
      sizes: this.completeWhiskySizes(option).sort((a, b) => b.size - a.size)
    }));
  }

  private completeWhiskySizes(option: BrandOption) {
    if (!this.productTypeForBrand(option.brand).includes('WHISKY')) {
      return option.sizes;
    }

    const standardSizes: Array<[number, number]> = [[90, 96], [180, 48], [375, 24], [750, 12], [1000, 12]];
    const sizes = [...option.sizes];
    standardSizes.forEach(([size, bottlesPerCase]) => {
      if (!sizes.some((item) => item.size === size)) {
        sizes.push({ size, bottlesPerCase, mrp: 0 });
      }
    });
    return sizes;
  }

  private async syncMrpCatalogFromFirebase() {
    const activeShopId = String(this.shop?.id || this.auth.currentUser()?.shopId || '').trim();
    if (!activeShopId) {
      return;
    }

    try {
      await this.mrpCatalog.loadCatalog(activeShopId);
    } catch {
      // Keep cached and built-in catalog data available when Firebase is offline.
    }
  }

  private mergeMrpCatalogs(catalogs: any[][]) {
    const brands = new Map<string, any>();
    catalogs.forEach((catalog) => catalog.forEach((brand: any) => {
      const code = String(brand?.code || '').trim();
      const name = String(brand?.brand || '').trim();
      if (!code || !name) return;
      const current = brands.get(code) || { code, brand: name, codes: [], sizes: [] };
      current.brand = current.brand || name;
      current.codes = Array.from(new Set([...(current.codes || []), code, ...(brand.codes || [])]));
      (brand.sizes || []).forEach((size: any) => {
        const sizeMl = this.parseSize(size?.sizeMl ?? size?.size);
        if (!sizeMl) return;
        const next = {
          size: sizeMl,
          sizeMl,
          sizeCode: String(size?.sizeCode || ''),
          mrp: Number(size?.mrp ?? size?.mrpValue ?? size?.price ?? 0),
          bottlesPerCase: this.unitsPerCaseFromCatalog(size)
        };
        const index = current.sizes.findIndex((item: any) => item.size === sizeMl);
        if (index >= 0) current.sizes[index] = { ...current.sizes[index], ...next };
        else current.sizes.push(next);
      });
      brands.set(code, current);
    }));
    return Array.from(brands.values()).filter((brand) => brand.sizes.length);
  }

  private normalize(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeCode(value: string) {
    return this.normalize(value).replace(/[^a-z0-9]/g, '');
  }

  private normalizeBrandSearch(value: string) {
    return this.normalizeCode(value).replace(/^mac(?=[a-z])/, 'mc');
  }

  private brandSearchScore(option: BrandOption, search: string, searchCode: string) {
    const code = this.normalizeCode(option.code);
    const aliases = option.aliases.map((alias) => this.normalizeCode(alias));
    const brand = this.normalize(option.brand);
    const compactBrand = this.normalizeBrandSearch(option.brand);
    const compactSearch = this.normalizeBrandSearch(search);
    const fullCodeAndBrand = this.normalize(`${option.code} - ${option.brand}`);
    if (fullCodeAndBrand === search || this.normalize(`${option.code} ${option.brand}`) === search) return 100;
    if (code === searchCode || aliases.includes(searchCode)) return 90;
    if (brand === search || compactBrand === compactSearch) return 80;
    if (code.startsWith(searchCode) || aliases.some((alias) => alias.startsWith(searchCode))) return 70;
    if (brand.startsWith(search) || compactBrand.startsWith(compactSearch)) return 60;
    if (brand.includes(search) || compactBrand.includes(compactSearch)) return 40;
    return 0;
  }

  private searchBrandOptions(search: string, searchCode: string) {
    return [...this.availableBrands]
      .map((item) => ({ item, score: this.brandSearchScore(item, search, searchCode) }))
      .filter((match) => match.score > 0)
      .sort((first, second) => second.score - first.score)
      .map((match) => match.item);
  }

  private loadExactStoredBrand(searchCode: string): BrandOption | null {
    if (!searchCode) {
      return null;
    }
    try {
      const activeShopId = String(this.shop?.id || this.auth.currentUser()?.shopId || '').trim();
      const preferredKeys = activeShopId ? [
        `vinoledger.mrp.brands.${activeShopId}`,
        `vinoledger.mrp.brands.${activeShopId.toUpperCase()}`,
        `vinoledger.mrp.brands.${activeShopId.toLowerCase()}`
      ] : [];
      const keys = [...preferredKeys, 'vinoledger.mrp.brands.global', 'vinoledger.mrp.brands', ...Object.keys(localStorage)]
        .filter((key, index, all) => key.startsWith('vinoledger.mrp.brands') && all.indexOf(key) === index);
      for (const key of keys) {
        const brands = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(brands)) {
          continue;
        }
        const brand = brands.find((item: any) => [item.code, ...(item.codes || [])]
          .some((code: unknown) => this.normalizeCode(String(code || '')) === searchCode));
        if (!brand || !brand.brand) {
          continue;
        }
        const option: BrandOption = {
          code: String(brand.code || '').trim(),
          brand: String(brand.brand || '').trim(),
          aliases: Array.from(new Set([brand.code, ...(brand.codes || [])].map((code: unknown) => String(code || '').trim()).filter(Boolean))),
          sizes: (brand.sizes || []).map((size: any) => ({
            size: this.parseSize(size.sizeMl ?? size.size),
            bottlesPerCase: this.unitsPerCaseFromCatalog(size),
            mrp: Number(size.mrp ?? size.mrpValue ?? size.price ?? 0)
          })).filter((size: BrandSize) => size.size > 0)
        };
        option.sizes = this.completeWhiskySizes(option).sort((first, second) => second.size - first.size);
        return option;
      }
    } catch {
      // Fall back to the assembled catalog when local storage is malformed.
    }
    return null;
  }

  private displayCodeForSearch(option: BrandOption, searchCode: string) {
    if (this.normalizeCode(option.code) === searchCode) {
      return option.code;
    }
    return option.aliases.find((alias) => this.normalizeCode(alias) === searchCode) || option.code;
  }

  private parseSize(value: unknown) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
    const parsedValue = String(value || '').match(/\d+(?:\.\d+)?/);
    return parsedValue ? Number(parsedValue[0]) : 0;
  }

  private unitsPerCaseFromCatalog(size: any): number {
    return Number(size?.bottlesPerCase ?? size?.unitsPerCase ?? size?.units_per_case ?? size?.['Units per case'] ?? size?.packQty ?? 0) || 0;
  }

  private sameBrand(first: OpeningStockRow, second: OpeningStockRow) {
    return this.normalize(first.code) === this.normalize(second.code)
      && this.normalize(first.brand) === this.normalize(second.brand);
  }

  private productTypeForBrand(brand: string) {
    const value = String(brand || '').toUpperCase();
    const types = ['BEER', 'WHISKY', 'BRANDY', 'WINE', 'VODKA', 'RUM'];
    return types.find((type) => value.includes(type)) || '';
  }
}

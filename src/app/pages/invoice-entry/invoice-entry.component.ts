import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BusinessDataService } from '../../services/business-data.service';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

type BrandSize = { size: number; bottlesPerCase: number };
type BrandOption = { code: string; brand: string; sizes: BrandSize[]; aliases: string[] };
type ParsedInvoice = { rows: InvoiceRow[]; amount: number | null };
type InvoiceRow = {
  code: string;
  brand: string;
  size: number;
  cases: number;
  bottles: number;
  prtDelivered: number;
  bottlesPerCase: number;
  isExistingBrand: boolean;
  sizeOptions: BrandSize[];
  customSize: string;
};
@Component({ selector: 'app-invoice-entry', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './invoice-entry.component.html', styleUrls: ['./invoice-entry.component.scss'] })
export class InvoiceEntryComponent {
  shop = JSON.parse(sessionStorage.getItem('vinoledger.shop') || '{"id":"KKD41","owner":"Y Bathalaswamy"}');
  date = sessionStorage.getItem('vinoledger.date') || new Date().toISOString().slice(0, 10);
  rows: InvoiceRow[] = [this.createRow('MH2094', 'Manson House')];
  invoiceValue: number | null = null;
  confirmationOpen = false;
  isSaving = false;
  status: 'success' | 'error' | null = null;
  statusMessage = '';
  uploadStatus: 'success' | 'error' | null = null;
  uploadedInvoiceName = '';
  uploadedInvoiceData = '';
  uploadedInvoiceType = '';
  isParsingInvoice = false;
  constructor(public auth: AuthService, private router: Router, private businessData: BusinessDataService) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';
    this.syncBrand(this.rows[0]);
  }
  goBack() { this.router.navigateByUrl('/sheet-date'); }
  update(row: InvoiceRow) {
    row.bottles = Math.max(0, Number(row.cases) || 0) * Math.max(0, Number(row.bottlesPerCase) || 0)
      + Math.max(0, Number(row.prtDelivered) || 0);
  }
  addRow(source?: InvoiceRow) {
    this.rows.push(this.createRow(source?.code || '', source?.brand || ''));
  }
  get totalCases() {
    return this.rows.reduce((total, row) => total + Math.max(0, Number(row.cases) || 0), 0);
  }
  get availableBrands() {
    return this.loadBrandOptions();
  }
  syncBrand(row: InvoiceRow) {
    const options = this.loadBrandOptions();
    const term = this.normalize(row.code || row.brand);
    const match = options.find((option) =>
      this.normalize(option.code) === this.normalize(row.code) ||
      this.normalize(option.brand) === this.normalize(row.brand) ||
      option.aliases.some((alias) => this.normalize(alias) === this.normalize(row.code)) ||
      (term && (this.normalize(option.code).includes(term) || this.normalize(option.brand).includes(term)))
    );
    if (match) {
      row.code = match.code;
      row.brand = match.brand;
      row.isExistingBrand = true;
      row.sizeOptions = [...match.sizes];
      const selectedSize = row.sizeOptions.find((size) => size.size === row.size) || row.sizeOptions[0];
      row.size = selectedSize?.size || 750;
      row.bottlesPerCase = selectedSize?.bottlesPerCase || 0;
      row.customSize = '';
    } else {
      row.isExistingBrand = false;
      row.sizeOptions = this.uniqueSizes([{ size: row.size, bottlesPerCase: row.bottlesPerCase }, ...row.sizeOptions]);
    }
    this.update(row);
  }
  selectBrand(row: InvoiceRow, value: string) {
    const search = this.normalize(value);
    const option = this.loadBrandOptions().find((item) =>
      this.normalize(`${item.code} ${item.brand}`) === search ||
      this.normalize(item.code) === search ||
      this.normalize(item.brand) === search
    );
    if (option) {
      row.code = option.code;
      row.brand = option.brand;
      this.syncBrand(row);
    }
  }
  brandDisplay(row: InvoiceRow) {
    return row.code && row.brand ? `${row.code} - ${row.brand}` : row.code || row.brand;
  }
  useCustomSize(row: InvoiceRow) {
    row.size = 0;
    row.customSize = '';
    this.update(row);
  }
  setCustomSize(row: InvoiceRow) {
    const size = Number(row.customSize);
    if (size > 0) row.size = size;
    this.update(row);
  }
  sizeChanged(row: InvoiceRow) {
    const selected = row.sizeOptions.find((option) => option.size === Number(row.size));
    if (selected) row.bottlesPerCase = selected.bottlesPerCase;
    this.update(row);
  }
  private createRow(code: string, brand: string): InvoiceRow {
    return {
      code, brand, size: 750, cases: 0, bottles: 0, prtDelivered: 0,
      bottlesPerCase: 0, isExistingBrand: false, sizeOptions: [{ size: 750, bottlesPerCase: 0 }], customSize: ''
    };
  }
  canSave() {
    return this.totalCases > 0
      && this.invoiceValue !== null && Number.isFinite(Number(this.invoiceValue)) && Number(this.invoiceValue) > 0
      && !!this.uploadedInvoiceName;
  }
  save() {
    if (!this.canSave()) {
      return;
    }
    this.confirmationOpen = true;
  }
  async confirmSave() {
    if (this.isSaving) {
      return;
    }
    this.confirmationOpen = false;
    const validRows = this.rows.some(row => row.code && row.brand && row.bottles > 0 && row.size > 0);
    this.status = null;
    this.statusMessage = '';
    if (!validRows) {
      this.status = 'error';
      return;
    }

    const shopId = String(this.shop.id || '');
    const invoice = {
      id: `INV-${Date.now()}`,
      date: this.date,
      referenceNo: `INV-${Date.now().toString().slice(-6)}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      amount: Number(this.invoiceValue),
      customer: this.shop.owner,
      shopId,
      cashier: this.auth.currentUser()?.name || '',
      status: 'submitted' as const,
      submittedAt: new Date().toISOString(),
      description: this.uploadedInvoiceName,
      totalCases: Number(this.totalCases),
      rows: this.rows.map(row => ({
        code: row.code, brand: row.brand, size: row.size, cases: row.cases,
        bottlesPerCase: row.bottlesPerCase, prtDelivered: row.prtDelivered, bottles: row.bottles
      })),
      fileName: this.uploadedInvoiceName,
      fileData: this.uploadedInvoiceData,
      fileType: this.uploadedInvoiceType
    };
    this.isSaving = true;
    try {
      await this.businessData.saveInvoice(invoice);
      const invoices = JSON.parse(localStorage.getItem('vinoledger.invoices') || '[]');
      localStorage.setItem('vinoledger.invoices', JSON.stringify([
        ...(Array.isArray(invoices) ? invoices : []),
        invoice
      ]));
      this.saveBrandSettings();
      this.status = 'success';
    } catch (error) {
      try {
        const invoices = JSON.parse(localStorage.getItem('vinoledger.invoices') || '[]');
        localStorage.setItem('vinoledger.invoices', JSON.stringify([
          ...(Array.isArray(invoices) ? invoices : []),
          invoice
        ]));
        this.saveBrandSettings();
        this.status = 'success';
        this.statusMessage = 'Saved locally. Firebase save failed, but the invoice is stored on this device.';
      } catch (localError) {
        this.status = 'error';
        this.statusMessage = localError instanceof Error
          ? `Firebase save failed: ${localError.message}`
          : 'Firebase save failed';
      }
    } finally {
      this.isSaving = false;
    }
  }
  cancelConfirmation() { this.confirmationOpen = false; }
  async uploadInvoice(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.isParsingInvoice = true;
    this.uploadStatus = null;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = file.name.toLowerCase().endsWith('.pdf')
        ? await this.parsePdfInvoice(buffer)
        : this.parseSpreadsheetInvoice(buffer);
      if (!parsed.rows.length) {
        throw new Error('No invoice rows were found. Check the file format and columns.');
      }
      this.rows = parsed.rows;
      if (parsed.amount !== null) this.invoiceValue = parsed.amount;
      this.uploadedInvoiceName = file.name;
      this.uploadedInvoiceData = await this.readAsDataUrl(file);
      this.uploadedInvoiceType = file.type || 'application/octet-stream';
      this.uploadStatus = 'success';
      this.statusMessage = `${parsed.rows.length} invoice brand rows loaded${parsed.amount !== null ? ` and invoice value ₹${parsed.amount.toFixed(2)} found` : ''}. Verify the details before submitting.`;
    } catch (error) {
      this.uploadStatus = 'error';
      this.statusMessage = error instanceof Error ? error.message : 'Unable to read the invoice file.';
    } finally {
      this.isParsingInvoice = false;
      input.value = '';
    }
  }
  close() {
    const invoiceSaved = this.status === 'success';
    this.status = null;
    this.statusMessage = '';
    this.uploadStatus = null;
    if (invoiceSaved) {
      this.router.navigateByUrl('/sheet-date');
    }
  }
  private parseSpreadsheetInvoice(buffer: ArrayBuffer): ParsedInvoice {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rows: InvoiceRow[] = [];
    let amount: number | null = null;
    workbook.SheetNames.forEach((sheetName) => {
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
      amount = amount ?? this.findInvoiceAmount(matrix.flat().map((value) => String(value ?? '')));
      matrix.forEach((line) => {
        const values = line.map((value) => String(value ?? '').trim());
        const code = values.find((value) => /^C\d+$/i.test(value)) || '';
        const pack = values.find((value) => /\d+\s*\/\s*\d+/.test(value)) || '';
        if (!code || !pack) return;
        const packMatch = pack.match(/(\d+)\s*\/\s*(\d+)/);
        if (!packMatch) return;
        const codeIndex = values.indexOf(code);
        const packIndex = values.indexOf(pack);
        const brand = values.slice(codeIndex + 1, packIndex).filter(Boolean).join(' ');
        const cases = Number(values[packIndex + 1]) || 0;
        const prtDelivered = Number(values[packIndex + 2]) || 0;
        rows.push(this.createImportedRow(code, brand, Number(packMatch[2]), Number(packMatch[1]), cases, prtDelivered));
      });
    });
    return { rows, amount };
  }
  private async parsePdfInvoice(buffer: ArrayBuffer): Promise<ParsedInvoice> {
    const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    let text = '';
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      text += `${content.items.map((item: any) => item.str).join(' ')} `;
    }
    const rows: InvoiceRow[] = [];
    const compact = text.replace(/\s+/g, ' ').trim();
    const rowPattern = /(?:^|\s)(\d+)\s+(C\d+)\s+([\s\S]*?)\s+(\d+)\s*\/\s*(\d+)\s+(\d+)\s+(\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(compact))) {
      rows.push(this.createImportedRow(match[2], match[3], Number(match[5]), Number(match[4]), Number(match[6]), Number(match[7])));
    }
    return { rows, amount: this.findInvoiceAmount([compact]) };
  }
  private createImportedRow(code: string, brand: string, size: number, bottlesPerCase: number, cases: number, prtDelivered: number) {
    const row = this.createRow(code, brand);
    row.size = size;
    row.bottlesPerCase = bottlesPerCase;
    row.cases = cases;
    row.prtDelivered = prtDelivered;
    this.syncBrand(row);
    row.size = size;
    row.bottlesPerCase = bottlesPerCase;
    this.update(row);
    return row;
  }
  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to store the uploaded invoice file.'));
      reader.readAsDataURL(file);
    });
  }
  private findInvoiceAmount(values: string[]): number | null {
    const text = values.join(' ').replace(/\s+/g, ' ');
    const amountMatch = text.match(/(?:invoice\s*(?:value|amount)|grand\s*total|total\s*(?:invoice\s*)?value|amount\s*payable)[^\d]{0,40}(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!amountMatch) return null;
    const amount = Number(amountMatch[1].replace(/,/g, ''));
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
  private loadBrandOptions(): BrandOption[] {
    const options = new Map<string, BrandOption>();
    const add = (code: string, brand: string, size: number | string, bottlesPerCase: number, aliases: string[] = []) => {
      if (!code && !brand) return;
      const parsedSize = this.parseSize(size);
      const key = this.normalize(code || brand);
      const current = options.get(key) || { code, brand, sizes: [], aliases: [] };
      current.code = current.code || code;
      current.brand = current.brand || brand;
      const existingSize = current.sizes.find((item) => item.size === parsedSize);
      if (existingSize) existingSize.bottlesPerCase = existingSize.bottlesPerCase || bottlesPerCase;
      else current.sizes.push({ size: parsedSize, bottlesPerCase });
      current.aliases = [...new Set([...current.aliases, ...aliases])];
      options.set(key, current);
      aliases.forEach((alias) => {
        const aliasKey = this.normalize(alias);
        if (aliasKey && !options.has(aliasKey)) options.set(aliasKey, current);
      });
    };
    add('MH2094', 'Manson House', 1000, 12);
    add('MH2094', 'Manson House', 750, 12);
    add('MH2094', 'Manson House', 375, 24);
    add('MH2094', 'Manson House', 180, 48);
    add('MH2094', 'Manson House', 90, 96);
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
      const brands = JSON.parse(localStorage.getItem('vinoledger.mrp.brands') || '[]');
      brands.forEach((item: any) => (item.sizes || []).forEach((size: any) => add(
        item.code,
        item.brand,
        size.sizeMl || size.size,
        Number(size.bottlesPerCase || size.packQty || 0),
        item.codes || []
      )));
    } catch { /* Keep invoice history available when catalog data is malformed. */ }
    try {
      const invoices = JSON.parse(localStorage.getItem('vinoledger.invoices') || '[]');
      invoices.forEach((invoice: any) => (invoice.rows || []).forEach((row: any) => add(row.code, row.brand, row.size, Number(row.bottlesPerCase || 0))));
    } catch { /* Ignore malformed legacy invoice data. */ }
    try {
      const settings = JSON.parse(localStorage.getItem(`vinoledger.invoice.brand-settings.${this.shop.id}`) || '[]');
      settings.forEach((setting: any) => add(setting.code, setting.brand, setting.size, Number(setting.bottlesPerCase || 0)));
    } catch { /* Ignore malformed brand settings. */ }
    return [...new Set(options.values())].map((option) => ({
      ...option,
      sizes: this.uniqueSizes(option.sizes).sort((a, b) => a.size - b.size)
    }));
  }
  private saveBrandSettings() {
    const settings = this.rows.filter((row) => row.code && row.brand && row.size > 0).map((row) => ({
      code: row.code, brand: row.brand, size: row.size, bottlesPerCase: row.bottlesPerCase
    }));
    const key = `vinoledger.invoice.brand-settings.${this.shop.id}`;
    const previous = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...(Array.isArray(previous) ? previous : []), ...settings]));
  }
  private uniqueSizes(sizes: BrandSize[]) {
    const unique = new Map<number, BrandSize>();
    sizes.forEach((size) => {
      const parsed = this.parseSize(size.size);
      if (parsed > 0 && !unique.has(parsed)) unique.set(parsed, { size: parsed, bottlesPerCase: Number(size.bottlesPerCase) || 0 });
    });
    return [...unique.values()];
  }
  private parseSize(value: number | string) {
    const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  private normalize(value: string) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
}

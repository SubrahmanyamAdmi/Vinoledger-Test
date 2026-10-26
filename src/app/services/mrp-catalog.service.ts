import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FirestoreService } from './firestore.service';

export interface MrpBrandSize {
  size: string;
  sizeCode?: string;
  sizeMl?: number;
  mrp: number;
  bottlesPerCase?: number;
}

export interface MrpCatalogBrand {
  brand: string;
  code: string;
  codes?: string[];
  category?: string;
  sizes: MrpBrandSize[];
}

export interface MrpOverrideSummaryItem {
  mrpKey: string;
  brand: string;
  code: string;
  codes: string[];
  size: string;
  sizeCode?: string;
  sizeMl: number;
  globalMrp: number;
  groups: Array<{ mrp: number; shopIds: string[] }>;
}

export interface MrpOverrideCopyPlan {
  sourceCount: number;
  copied: number;
  kept: number;
  targetExistingCount: number;
}

export function countOverridesByShop(items: MrpOverrideSummaryItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  items.forEach((item) => item.groups.forEach((group) => group.shopIds.forEach((id) => {
    counts[id] = (counts[id] || 0) + 1;
  })));
  return counts;
}

interface MrpOverrideGroup {
  overrideMrp: number;
  shopIds: string[];
  status: 'override';
  updatedAt: string;
}

interface MrpCatalogRecord {
  id?: string;
  mrpKey: string;
  brand: string;
  code: string;
  codes: string[];
  category?: string;
  size: string;
  sizeCode?: string;
  sizeMl: number;
  globalMrp: number;
  bottlesPerCase?: number;
  overrideGroups: MrpOverrideGroup[];
  globalUpdatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class MrpCatalogService {
  private readonly collection = 'mrpCatalog';
  private readonly localRecordKey = 'vinoledger.mrp.catalog.records';

  constructor(private firestore: FirestoreService) {}

  async loadCatalog(shopId = ''): Promise<MrpCatalogBrand[]> {
    const [records, legacyGlobal, legacyOverrides] = await Promise.all([
      this.getCurrentRecords(),
      this.getLegacyBrands('global'),
      shopId ? this.getLegacyOverrideBrands(shopId) : Promise.resolve([]),
    ]);

    const currentGlobal = this.recordsToBrands(records, '');
    const currentShop = shopId ? this.recordsToBrands(records, shopId, true) : [];
    const global = this.mergeBrands([legacyGlobal, currentGlobal]);
    const effective = shopId
      ? this.mergeBrands([global, legacyOverrides, currentShop])
      : global;

    this.cacheCatalog(effective, shopId);
    return effective;
  }

  async saveGlobalCatalog(brands: MrpCatalogBrand[]): Promise<void> {
    const existingRecords = await this.getCurrentRecords();
    const existingByKey = new Map(existingRecords.map((record) => [record.mrpKey, record]));
    const now = new Date().toISOString();
    const nextRecords = existingRecords.filter((record) =>
      !this.brandsToRecords(brands).some((incoming) => incoming.mrpKey === record.mrpKey)
    );

    for (const entry of this.brandsToRecords(brands)) {
      const current = existingByKey.get(entry.mrpKey);
      const nextRecord: MrpCatalogRecord = {
        ...entry,
        overrideGroups: current?.overrideGroups || [],
        globalUpdatedAt: now,
      };
      nextRecords.push(nextRecord);
      if (this.isFirebaseConfigured()) {
        await this.firestore.setDocument<MrpCatalogRecord>(this.collection, entry.mrpKey, nextRecord);
      }
    }

    this.writeLocalRecords(nextRecords);
    this.cacheCatalog(this.mergeBrands([brands]), '');
  }

  async saveShopOverrides(shopId: string, effectiveBrands: MrpCatalogBrand[]): Promise<void> {
    const normalizedShopId = String(shopId || '').trim();
    if (!normalizedShopId) {
      throw new Error('A shop is required to save MRP overrides.');
    }

    let records = await this.getCurrentRecords();
    if (!records.length) {
      const legacyGlobal = await this.getLegacyBrands('global');
      if (!legacyGlobal.length) {
        throw new Error('The global MRP catalog is unavailable. Import the global catalog before saving shop overrides.');
      }
      await this.saveGlobalCatalog(legacyGlobal);
      records = await this.getCurrentRecords();
    }

    const effectiveByKey = new Map(
      this.brandsToRecords(effectiveBrands).map((record) => [record.mrpKey, record.globalMrp])
    );
    const now = new Date().toISOString();

    for (const record of records) {
      const requestedMrp = effectiveByKey.get(record.mrpKey);
      if (requestedMrp === undefined) {
        continue;
      }

      const nextGroups = this.updateOverrideGroups(
        record.overrideGroups || [],
        normalizedShopId,
        requestedMrp,
        record.globalMrp,
        now
      );

      if (JSON.stringify(nextGroups) !== JSON.stringify(record.overrideGroups || [])) {
        const nextRecord = {
          ...record,
          overrideGroups: nextGroups,
        };
        const index = records.findIndex((candidate) => candidate.mrpKey === record.mrpKey);
        records[index] = nextRecord;
        if (this.isFirebaseConfigured()) {
          await this.firestore.setDocument<MrpCatalogRecord>(this.collection, record.mrpKey, nextRecord);
        }
      }
    }

    this.writeLocalRecords(records);
    if (this.isFirebaseConfigured()) {
      await this.removeLegacyOverride(normalizedShopId);
    } else {
      localStorage.removeItem(`vinoledger.mrp.overrides.${normalizedShopId}`);
    }
    await this.loadCatalog(normalizedShopId);
  }

  async loadOverrideSummary(shopIds: string[]): Promise<MrpOverrideSummaryItem[]> {
    const global = await this.loadCatalog();
    const items = new Map<string, MrpOverrideSummaryItem>();
    const globalMrp = new Map<string, number>();
    const sizeKey = (brand: MrpCatalogBrand, size: MrpBrandSize) =>
      `${brand.code}|${size.sizeCode || size.sizeMl || size.size}`;
    global.forEach((brand) => brand.sizes.forEach((size) => globalMrp.set(sizeKey(brand, size), Number(size.mrp))));

    for (const shopId of shopIds) {
      const effective = await this.loadCatalog(shopId);
      effective.forEach((brand) => brand.sizes.forEach((size) => {
        const key = sizeKey(brand, size);
        const base = globalMrp.get(key);
        if (base === undefined || base === Number(size.mrp)) return;
        const item = items.get(key) || {
          mrpKey: key,
          brand: brand.brand,
          code: brand.code,
          codes: brand.codes?.length ? brand.codes : [brand.code],
          size: size.size,
          sizeCode: size.sizeCode,
          sizeMl: Number(size.sizeMl || 0),
          globalMrp: base,
          groups: [],
        };
        const group = item.groups.find((entry) => entry.mrp === Number(size.mrp));
        if (group) group.shopIds.push(shopId);
        else item.groups.push({ mrp: Number(size.mrp), shopIds: [shopId] });
        items.set(key, item);
      }));
    }

    return [...items.values()]
      .map((item) => ({ ...item, groups: item.groups.sort((a, b) => a.mrp - b.mrp) }))
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.sizeMl - b.sizeMl);
  }

  async resetShopOverrides(shopId: string): Promise<void> {
    const normalizedShopId = String(shopId || '').trim();
    if (!normalizedShopId) {
      throw new Error('A shop is required to reset MRP overrides.');
    }

    const records = await this.getCurrentRecords();
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const groups = (record.overrideGroups || [])
        .map((group) => ({ ...group, shopIds: (group.shopIds || []).filter((id) => id !== normalizedShopId) }))
        .filter((group) => group.shopIds.length > 0);
      if (groups.length === (record.overrideGroups || []).length
        && groups.every((group, i) => group.shopIds.length === record.overrideGroups[i].shopIds.length)) {
        continue;
      }
      records[index] = { ...record, overrideGroups: groups };
      if (this.isFirebaseConfigured()) {
        await this.firestore.setDocument<MrpCatalogRecord>(this.collection, record.mrpKey, records[index]);
      }
    }

    this.writeLocalRecords(records);
    if (this.isFirebaseConfigured()) {
      await this.removeLegacyOverride(normalizedShopId);
    } else {
      localStorage.removeItem(`vinoledger.mrp.overrides.${normalizedShopId}`);
    }
    await this.loadCatalog(normalizedShopId);
  }

  async planShopOverrideCopy(
    sourceShopId: string,
    targetShopId: string,
    replaceExisting = false
  ): Promise<MrpOverrideCopyPlan & { brands: MrpCatalogBrand[] }> {
    const source = String(sourceShopId || '').trim();
    const target = String(targetShopId || '').trim();
    if (!source || !target || source.toLowerCase() === target.toLowerCase()) {
      throw new Error('Choose two different shops to copy MRP overrides.');
    }

    const [global, sourceCatalog, targetCatalog] = await Promise.all([
      this.loadCatalog(),
      this.loadCatalog(source),
      this.loadCatalog(target),
    ]);
    const priceMap = (brands: MrpCatalogBrand[]) => new Map(
      this.brandsToRecords(brands).map((record) => [record.mrpKey, record.globalMrp])
    );
    const globalPrices = priceMap(global);
    const sourcePrices = priceMap(sourceCatalog);
    const targetPrices = priceMap(targetCatalog);

    const plan = { sourceCount: 0, copied: 0, kept: 0, targetExistingCount: 0 };
    const nextPrices = new Map<string, number>();
    globalPrices.forEach((globalMrp, key) => {
      const targetMrp = targetPrices.get(key) ?? globalMrp;
      const targetOverridden = targetMrp !== globalMrp;
      if (targetOverridden) plan.targetExistingCount++;
      nextPrices.set(key, replaceExisting ? globalMrp : targetMrp);
    });

    sourcePrices.forEach((sourceMrp, key) => {
      const globalMrp = globalPrices.get(key);
      if (globalMrp === undefined || sourceMrp === globalMrp) return;
      plan.sourceCount++;
      const targetMrp = targetPrices.get(key) ?? globalMrp;
      if (!replaceExisting && targetMrp !== globalMrp) {
        if (targetMrp !== sourceMrp) plan.kept++;
        return;
      }
      if (targetMrp !== sourceMrp) plan.copied++;
      nextPrices.set(key, sourceMrp);
    });

    const brands = global.map((brand) => ({
      ...brand,
      sizes: brand.sizes.map((size) => {
        const key = this.mrpKey(brand.code, Number(size.sizeMl || this.parseSizeMl(size.size)), size.sizeCode);
        return { ...size, mrp: nextPrices.get(key) ?? Number(size.mrp) };
      }),
    }));
    return { ...plan, brands };
  }

  async copyShopOverrides(sourceShopId: string, targetShopId: string, replaceExisting = false): Promise<MrpOverrideCopyPlan> {
    const { brands, ...plan } = await this.planShopOverrideCopy(sourceShopId, targetShopId, replaceExisting);
    await this.saveShopOverrides(targetShopId, brands);
    return plan;
  }

  async resetAllShopOverrides(shopIds: string[]): Promise<void> {
    const normalizedShopIds = [...new Set(shopIds.map((shopId) => String(shopId || '').trim()).filter(Boolean))];
    const records = await this.getCurrentRecords();
    const affectedShopIds = new Set(normalizedShopIds);

    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      (record.overrideGroups || []).forEach((group) => {
        (group.shopIds || []).forEach((shopId) => affectedShopIds.add(shopId));
      });
      if (!record.overrideGroups?.length) continue;

      records[index] = { ...record, overrideGroups: [] };
      if (this.isFirebaseConfigured()) {
        await this.firestore.setDocument<MrpCatalogRecord>(this.collection, record.mrpKey, records[index]);
      }
    }

    this.writeLocalRecords(records);
    if (this.isFirebaseConfigured()) {
      for (const shopId of affectedShopIds) {
        await this.removeLegacyOverride(shopId, false);
      }
    } else {
      for (const shopId of affectedShopIds) {
        localStorage.removeItem(`vinoledger.mrp.overrides.${shopId}`);
      }
    }

    await this.loadCatalog();
  }

  private async getCurrentRecords(): Promise<MrpCatalogRecord[]> {
    if (!this.isFirebaseConfigured()) {
      return this.readLocalRecords();
    }

    try {
      const documents = await firstValueFrom(this.firestore.getCollection<MrpCatalogRecord>(this.collection));
      return documents
        .filter((document) => document.mrpKey && document.mrpKey !== 'global')
        .map((document) => ({
          ...document,
          overrideGroups: Array.isArray(document.overrideGroups) ? document.overrideGroups : [],
          codes: Array.isArray(document.codes) ? document.codes : [document.code].filter(Boolean),
          sizeMl: Number(document.sizeMl || this.parseSizeMl(document.size)),
          globalMrp: Number(document.globalMrp || 0),
        }))
        .filter((document) => document.code && document.brand && document.sizeMl > 0);
    } catch {
      return [];
    }
  }

  private readLocalRecords(): MrpCatalogRecord[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.localRecordKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocalRecords(records: MrpCatalogRecord[]) {
    localStorage.setItem(this.localRecordKey, JSON.stringify(records));
  }

  private async getLegacyBrands(documentId: string): Promise<MrpCatalogBrand[]> {
    if (!this.isFirebaseConfigured()) {
      return this.readCachedCatalog('');
    }

    try {
      const document = await this.firestore.getDocumentOnce<{ brands?: MrpCatalogBrand[] }>(this.collection, documentId);
      return Array.isArray(document?.brands) ? document.brands : [];
    } catch {
      return this.readCachedCatalog('');
    }
  }

  private async getLegacyOverrideBrands(shopId: string): Promise<MrpCatalogBrand[]> {
    if (!this.isFirebaseConfigured()) {
      return this.readLegacyOverrideCache(shopId);
    }

    try {
      const document = await this.firestore.getDocumentOnce<{ brands?: MrpCatalogBrand[] }>('mrpCatalogOverrides', shopId);
      return Array.isArray(document?.brands) ? document.brands : this.readLegacyOverrideCache(shopId);
    } catch {
      return this.readLegacyOverrideCache(shopId);
    }
  }

  private async removeLegacyOverride(shopId: string, ignoreErrors = true): Promise<void> {
    localStorage.removeItem(`vinoledger.mrp.overrides.${shopId}`);
    try {
      await this.firestore.deleteDocument('mrpCatalogOverrides', shopId);
    } catch {
      if (!ignoreErrors) {
        throw new Error(`Could not remove the legacy MRP override for shop ${shopId}.`);
      }
    }
  }

  private updateOverrideGroups(
    groups: MrpOverrideGroup[],
    shopId: string,
    requestedMrp: number,
    globalMrp: number,
    updatedAt: string
  ): MrpOverrideGroup[] {
    const withoutShop = groups
      .map((group) => ({
        ...group,
        shopIds: (group.shopIds || []).filter((candidate) => candidate !== shopId),
      }))
      .filter((group) => group.shopIds.length > 0);

    if (Number(requestedMrp) === Number(globalMrp)) {
      return withoutShop;
    }

    const matchingGroup = withoutShop.find((group) => Number(group.overrideMrp) === Number(requestedMrp));
    if (matchingGroup) {
      matchingGroup.shopIds = [...new Set([...matchingGroup.shopIds, shopId])];
      matchingGroup.updatedAt = updatedAt;
      return withoutShop;
    }

    return [
      ...withoutShop,
      {
        overrideMrp: Number(requestedMrp),
        shopIds: [shopId],
        status: 'override',
        updatedAt,
      },
    ];
  }

  private recordsToBrands(records: MrpCatalogRecord[], shopId: string, onlyOverrides = false): MrpCatalogBrand[] {
    const grouped = new Map<string, MrpCatalogBrand>();

    records.forEach((record) => {
      const current = grouped.get(record.code) || {
        brand: record.brand,
        code: record.code,
        codes: record.codes,
        category: record.category,
        sizes: [],
      };
      const override = shopId
        ? record.overrideGroups.find((group) => group.status === 'override' && group.shopIds.includes(shopId))
        : undefined;
      if (onlyOverrides && !override) {
        return;
      }

      current.sizes.push({
        size: record.size || `${record.sizeMl}ml`,
        sizeCode: record.sizeCode,
        sizeMl: record.sizeMl,
        mrp: Number(override?.overrideMrp ?? record.globalMrp),
        bottlesPerCase: record.bottlesPerCase,
      });
      grouped.set(record.code, current);
    });

    return Array.from(grouped.values());
  }

  private brandsToRecords(brands: MrpCatalogBrand[]): MrpCatalogRecord[] {
    const records = new Map<string, MrpCatalogRecord>();

    brands.forEach((brand) => {
      const code = String(brand.code || '').trim();
      const name = String(brand.brand || '').trim();
      if (!code || !name) {
        return;
      }

      (brand.sizes || []).forEach((size) => {
        const sizeMl = Number(size.sizeMl || this.parseSizeMl(size.size));
        const mrp = Number(size.mrp);
        if (sizeMl <= 0 || !Number.isFinite(mrp)) {
          return;
        }

        const mrpKey = this.mrpKey(code, sizeMl, size.sizeCode);
        records.set(mrpKey, {
          mrpKey,
          brand: name,
          code,
          codes: Array.from(new Set([code, ...(brand.codes || [])].filter(Boolean))),
          category: brand.category,
          size: String(size.size || `${sizeMl}ml`),
          sizeCode: size.sizeCode ? String(size.sizeCode).trim() : '',
          sizeMl,
          globalMrp: mrp,
          bottlesPerCase: Number(size.bottlesPerCase || 0) || undefined,
          overrideGroups: [],
        });
      });
    });

    return Array.from(records.values());
  }

  private mergeBrands(catalogs: MrpCatalogBrand[][]): MrpCatalogBrand[] {
    const brands = new Map<string, MrpCatalogBrand>();

    catalogs.forEach((catalog) => catalog.forEach((incoming) => {
      const key = this.normalize(incoming.code || incoming.brand);
      if (!key) {
        return;
      }

      const current = brands.get(key) || {
        brand: incoming.brand,
        code: incoming.code,
        codes: [],
        category: incoming.category,
        sizes: [],
      };
      current.brand = incoming.brand || current.brand;
      current.code = incoming.code || current.code;
      current.codes = Array.from(new Set([...(current.codes || []), current.code, ...(incoming.codes || [])].filter(Boolean)));
      current.category = incoming.category || current.category;

      (incoming.sizes || []).forEach((size) => {
        const sizeKey = this.mrpKey(current.code, Number(size.sizeMl || this.parseSizeMl(size.size)), size.sizeCode);
        const index = current.sizes.findIndex((candidate) =>
          this.mrpKey(current.code, Number(candidate.sizeMl || this.parseSizeMl(candidate.size)), candidate.sizeCode) === sizeKey
        );
        if (index >= 0) {
          current.sizes[index] = { ...current.sizes[index], ...size };
        } else {
          current.sizes.push({ ...size });
        }
      });

      brands.set(key, current);
    }));

    return Array.from(brands.values());
  }

  private cacheCatalog(brands: MrpCatalogBrand[], shopId: string) {
    const key = shopId ? `vinoledger.mrp.brands.${shopId}` : 'vinoledger.mrp.brands.global';
    localStorage.setItem(key, JSON.stringify(brands));
  }

  private readCachedCatalog(shopId: string): MrpCatalogBrand[] {
    try {
      const key = shopId ? `vinoledger.mrp.brands.${shopId}` : 'vinoledger.mrp.brands.global';
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private readLegacyOverrideCache(shopId: string): MrpCatalogBrand[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(`vinoledger.mrp.overrides.${shopId}`) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private mrpKey(code: string, sizeMl: number, sizeCode?: string): string {
    const normalizedCode = this.normalize(code);
    const normalizedSizeCode = this.normalize(sizeCode || '');
    return `${normalizedCode}-${normalizedSizeCode || Number(sizeMl)}`;
  }

  private parseSizeMl(value: unknown): number {
    const match = String(value || '').match(/[0-9]+(?:\.[0-9]+)?/);
    const parsed = Number(match?.[0] || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private normalize(value: string): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private isFirebaseConfigured() {
    const config = environment.firebaseConfig;
    return Boolean(config.apiKey && config.appId && config.projectId &&
      config.apiKey !== 'YOUR_API_KEY' && config.projectId !== 'YOUR_PROJECT_ID');
  }
}

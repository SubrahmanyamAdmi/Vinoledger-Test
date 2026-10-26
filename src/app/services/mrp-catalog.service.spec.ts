import { of } from 'rxjs';
import { MrpCatalogService } from './mrp-catalog.service';

describe('MrpCatalogService', () => {
  const globalBrand = {
    brand: 'Test Brand',
    code: 'C001',
    codes: ['C001'],
    sizes: [{ size: '180ml', sizeMl: 180, mrp: 200, bottlesPerCase: 48 }],
  };

  let documents: any[];
  let firestore: any;
  let service: MrpCatalogService;

  beforeEach(() => {
    documents = [{
      id: 'c001-180',
      mrpKey: 'c001-180',
      brand: 'Test Brand',
      code: 'C001',
      codes: ['C001'],
      size: '180ml',
      sizeMl: 180,
      globalMrp: 200,
      bottlesPerCase: 48,
      overrideGroups: [{
        overrideMrp: 220,
        shopIds: ['SHOP-A', 'SHOP-B'],
        status: 'override',
        updatedAt: '2026-10-10T00:00:00.000Z',
      }],
    }];

    firestore = {
      getCollection: () => of(documents),
      getDocumentOnce: () => Promise.resolve(null),
      setDocument: (_collection: string, id: string, value: any) => {
        const index = documents.findIndex((document) => document.mrpKey === id);
        if (index >= 0) {
          documents[index] = { ...value, id };
        } else {
          documents.push({ ...value, id });
        }
        return Promise.resolve();
      },
      deleteDocument: () => Promise.resolve(),
    };
    service = new MrpCatalogService(firestore);
  });

  it('preserves override groups when a global import changes the global MRP', async () => {
    await service.saveGlobalCatalog([{
      ...globalBrand,
      sizes: [{ ...globalBrand.sizes[0], mrp: 210 }],
    }]);

    expect(documents[0].globalMrp).toBe(210);
    expect(documents[0].overrideGroups).toEqual([jasmine.objectContaining({
      overrideMrp: 220,
      shopIds: ['SHOP-A', 'SHOP-B'],
    })]);
  });

  it('moves only the editing shop to the requested shared override group', async () => {
    await service.saveShopOverrides('SHOP-A', [{
      ...globalBrand,
      sizes: [{ ...globalBrand.sizes[0], mrp: 230 }],
    }]);

    expect(documents[0].overrideGroups).toEqual([
      jasmine.objectContaining({ overrideMrp: 220, shopIds: ['SHOP-B'] }),
      jasmine.objectContaining({ overrideMrp: 230, shopIds: ['SHOP-A'] }),
    ]);
  });

  it('adds a shop to an existing override group when it chooses the same MRP', async () => {
    await service.saveShopOverrides('SHOP-C', [{
      ...globalBrand,
      sizes: [{ ...globalBrand.sizes[0], mrp: 220 }],
    }]);

    expect(documents[0].overrideGroups).toEqual([jasmine.objectContaining({
      overrideMrp: 220,
      shopIds: ['SHOP-A', 'SHOP-B', 'SHOP-C'],
    })]);
  });

  it('resets only the given shop to the global MRP', async () => {
    await service.resetShopOverrides('SHOP-A');

    expect(documents[0].overrideGroups).toEqual([jasmine.objectContaining({ overrideMrp: 220, shopIds: ['SHOP-B'] })]);
    const shopA = await service.loadCatalog('SHOP-A');
    expect(shopA[0].sizes[0].mrp).toBe(200);
    const shopB = await service.loadCatalog('SHOP-B');
    expect(shopB[0].sizes[0].mrp).toBe(220);
  });

  it('resets every shop override without changing the global MRP', async () => {
    await service.resetAllShopOverrides(['SHOP-A', 'SHOP-B']);

    expect(documents[0].globalMrp).toBe(200);
    expect(documents[0].overrideGroups).toEqual([]);
    const shopA = await service.loadCatalog('SHOP-A');
    expect(shopA[0].sizes[0].mrp).toBe(200);
    const shopB = await service.loadCatalog('SHOP-B');
    expect(shopB[0].sizes[0].mrp).toBe(200);
  });

  it('copies source overrides to a new shop and leaves the global MRP unchanged', async () => {
    const plan = await service.copyShopOverrides('SHOP-A', 'SHOP-X');

    expect(plan).toEqual(jasmine.objectContaining({ sourceCount: 1, copied: 1, kept: 0 }));
    expect(documents[0].globalMrp).toBe(200);
    expect(documents[0].overrideGroups).toEqual([
      jasmine.objectContaining({ overrideMrp: 220, shopIds: ['SHOP-A', 'SHOP-B', 'SHOP-X'] }),
    ]);
    const shopX = await service.loadCatalog('SHOP-X');
    expect(shopX[0].sizes[0].mrp).toBe(220);
  });

  it('keeps the target own override when merging and replaces it only on request', async () => {
    await service.saveShopOverrides('SHOP-X', [{
      ...globalBrand,
      sizes: [{ ...globalBrand.sizes[0], mrp: 250 }],
    }]);

    const merged = await service.copyShopOverrides('SHOP-A', 'SHOP-X');
    expect(merged).toEqual(jasmine.objectContaining({ copied: 0, kept: 1 }));
    expect((await service.loadCatalog('SHOP-X'))[0].sizes[0].mrp).toBe(250);

    const replaced = await service.copyShopOverrides('SHOP-A', 'SHOP-X', true);
    expect(replaced.copied).toBe(1);
    expect((await service.loadCatalog('SHOP-X'))[0].sizes[0].mrp).toBe(220);
  });

  it('rejects copying a shop onto itself', async () => {
    await expectAsync(service.copyShopOverrides('SHOP-A', 'shop-a')).toBeRejected();
  });
});

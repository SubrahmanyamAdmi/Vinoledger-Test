import { AdminUpdateMrpComponent } from './admin-update-mrp.component';

describe('AdminUpdateMrpComponent import rules', () => {
  let component: AdminUpdateMrpComponent;

  beforeEach(() => {
    component = new AdminUpdateMrpComponent(
      {
        userRole: () => 'Admin',
        currentUser: () => ({ shopId: 'shop-1' })
      } as any,
      { navigate: jasmine.createSpy('navigate') } as any,
      {
        getDocumentOnce: jasmine.createSpy('getDocumentOnce'),
        setDocument: jasmine.createSpy('setDocument')
      } as any,
      {
        getShops: () => ({ subscribe: () => undefined })
      } as any
    );
  });

  it('merges same brand and same size across pack variations and keeps the last MRP', () => {
    const brands = (component as any).mergeBrands([
      {
        brand: 'ICONIQ WHITE SUPREME INTERNATIONAL GRAIN WHISKY',
        code: '1249',
        codes: ['1249'],
        sizes: [
          { size: '180ml', sizeCode: 'G', sizeMl: 180, mrp: 200 },
          { size: '750ml', sizeCode: 'G', sizeMl: 750, mrp: 730 }
        ]
      },
      {
        brand: 'ICONIQ WHITE SUPREME INTERNATIONAL GRAIN WHISKY',
        code: 'C844',
        codes: ['C844'],
        sizes: [
          { size: '180', sizeCode: 'P', sizeMl: 180, mrp: 200 },
          { size: '750', sizeCode: 'P', sizeMl: 750, mrp: 730 }
        ]
      },
      {
        brand: 'ICONIQ WHITE SUPREME INTERNATIONAL GRAIN WHISKY',
        code: 'C844',
        codes: ['C844'],
        sizes: [
          { size: '750ml', sizeCode: 'P', sizeMl: 750, mrp: 780 }
        ]
      }
    ]);

    expect(brands.length).toBe(1);
    expect(brands[0].brand).toBe('ICONIQ WHITE SUPREME INTERNATIONAL GRAIN WHISKY');
    expect(brands[0].sizes.find((size: any) => size.sizeMl === 180)?.mrp).toBe(200);
    expect(brands[0].sizes.find((size: any) => size.sizeMl === 750)?.mrp).toBe(780);
  });

  it('imports Units per case into the brand size record', () => {
    const brands = (component as any).parseWorkbookMatrix([
      ['Brand Code', 'Brand Name', 'Size (ml)', 'Units per case', 'MRP'],
      ['C123', 'TEST BRANDY', 375, 24, 500]
    ]);

    expect(brands[0].sizes[0].bottlesPerCase).toBe(24);
  });
});

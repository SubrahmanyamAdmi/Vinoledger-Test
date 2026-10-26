# Vinoledger

## Firebase backend setup

The application uses Firebase Authentication and Cloud Firestore. Before using real backend data:

1. Create a Firebase project at https://console.firebase.google.com/.
2. Enable **Authentication > Sign-in method > Email/Password**.
3. Create a **Cloud Firestore** database in production mode.
4. Register a web app in the Firebase project and copy its config into both `src/environments/environment.ts` and `src/environments/environment.prod.ts`.
5. Create the first authenticated admin user, then create its Firestore document at `users/{firebaseUid}` with `{ "role": "Admin", "name": "...", "email": "..." }`.
6. Deploy the security rules from this project with `firebase deploy --only firestore:rules` after installing and logging into the Firebase CLI.

The registration screen writes the shop to `shops/{SHOP_ID}` and owner/cashier profiles to `users/{USER_ID}`. Production login credentials should be created through a Firebase Admin SDK callable Cloud Function; do not store passwords in Firestore or rely on the current local demo-account fallback for production.

## MRP catalog model

The global MRP catalog uses one Firestore document per stable product-size key:

```text
mrpCatalog/{normalized-brand-code}-{size-code-or-size-ml}
```

Each record stores its global MRP once and keeps sparse `overrideGroups`. An override group contains one overridden MRP and the `shopIds` using that same value. This avoids complete per-shop catalog copies and avoids repeating the same override price for every shop.

When resolving a price, the application uses the matching override group for the active shop; when no matching group exists, it uses the global MRP. Admin global imports update only global catalog fields and preserve existing override groups. When a shop returns to the global value, the shop is removed from its override group and empty groups are removed.

The application can still read the previous `mrpCatalog/global` and `mrpCatalogOverrides/{shopId}` documents during migration. The first shop-specific save moves that shop's values into the grouped catalog format and removes its legacy override document.

## Database structure rules

### Canonical Firestore collections

| Collection | Document ID | Rule |
| --- | --- | --- |
| `users` | Firebase UID | Stores the authenticated user's role and assigned `shopId`. |
| `shops` | Shop ID | Stores the shop profile, opening date, owner, and cashier details. |
| `invoices` | Generated ID | Every invoice must include its `shopId` and business date. |
| `daySheets` | `day-sheet-{shopId}-{date}` | One document per shop and date; save and submit update the same document. |
| `openingStock` | `opening-stock-{shopId}` | One opening-stock document per shop. |
| `mrpCatalog` | Stable MRP key | One global product-size record; never create a complete catalog per shop. |
| `partnerManagement` | Shop ID | Stores a shop's partner roster and partner transactions. |
| `purchaseOrders` | Generated ID | Each order must include the requesting `shopId`. |

### Tenant and identity rules

1. Every shop-owned business record must include a `shopId`.
2. The application must use the authenticated user's `shopId`; do not trust a shop ID supplied only by route or browser storage.
3. Use deterministic IDs when a document represents a unique business identity, such as a day sheet or opening stock.
4. Store timestamps as ISO strings or Firestore timestamps consistently for the collection.
5. Browser storage and IndexedDB are caches/fallbacks. Firestore is the shared source of truth when Firebase is configured.

### Day-sheet lifecycle rules

```text
daySheets/{shop-date}
  status: "draft" | "submitted"
  draft: true | false
```

1. Saving a day sheet writes `status: "draft"` and `draft: true`.
2. Submitting the same shop/date document writes `status: "submitted"` and `draft: false`.
3. Do not create a second submitted document for an existing draft.
4. Drafts must not affect submitted-date locks, reports, stock, or owner summaries.
5. A submitted date is immutable to the cashier workflow and unlocks only the next pending shop date.

### MRP catalog rules

An MRP record must use a stable key:

```text
mrpKey = normalized brand code + size code
```

When a size code is unavailable, use the normalized bottle size in millilitres:

```text
mrpKey = normalized brand code + sizeMl
```

Each `mrpCatalog/{mrpKey}` document follows this logical structure:

```ts
{
  mrpKey: 'c001-180',
  brand: 'Test Brand',
  code: 'C001',
  codes: ['C001', 'C-001'],
  category: 'WHISKY',
  size: '180ml',
  sizeCode: '',
  sizeMl: 180,
  globalMrp: 200,
  bottlesPerCase: 48,
  overrideGroups: [
    {
      overrideMrp: 220,
      shopIds: ['SHOP-A', 'SHOP-B'],
      status: 'override',
      updatedAt: '...'
    }
  ],
  globalUpdatedAt: '...'
}
```

`codes`, `category`, `sizeCode`, `bottlesPerCase`, and `globalUpdatedAt` are optional where the catalog data does not provide them. The Firestore document ID is the `mrpKey`; `sizeCode` is normalized and used when present, otherwise `sizeMl` is used. The record's `code` remains the canonical brand code.

1. Store the global MRP once per key.
2. Store only shops that differ from the global MRP.
3. Shops using the same overridden value must share one override group for that key.
4. A shop may belong to at most one override group for an MRP key.
5. When a shop selects a different override MRP, remove it from its old group and add it to the matching/new group.
6. When a shop returns to the global MRP, remove it from the override group.
7. Remove an override group when it has no `shopIds`.
8. Resolve the effective MRP by checking whether the active `shopId` belongs to an override group; otherwise use `globalMrp`.
9. Admin imports may update global product data and `globalMrp`, but must preserve all existing `overrideGroups`.
10. Do not automatically delete keys missing from an import. Mark them for review or explicitly archive them so historical business data remains valid.

### Data safety rules

1. Do not store passwords, authentication tokens, or secrets in Firestore, IndexedDB, localStorage, source code, or committed scripts.
2. Production Firestore rules must enforce authentication, role permissions, and `shopId` tenancy.
3. Never use development-wide open read/write rules in production.
4. Update a shared MRP record atomically or with conflict-aware logic when concurrent Admin/Owner changes are possible.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.3.0.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

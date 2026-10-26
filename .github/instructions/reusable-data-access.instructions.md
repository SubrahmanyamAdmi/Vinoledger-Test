---
description: "Use when creating or changing APIs, Firestore/local persistence, database collections, schemas, or data access. Guides checking and reusing existing VinoLedger services, models, and storage structures before adding new ones."
---

# Reusable data-access patterns

- Before adding an API call, database collection/document shape, model, or persistence flow, search the workspace for an existing service, type, collection, and read/write pattern that already represents the same data.
- Reuse and extend the existing data-access service, typed model, and persisted structure when they fit the requirement. Keep local and remote persistence behavior consistent with the existing feature.
- Create a new API, service, collection, schema, or model only when no existing structure fits. Keep the new contract typed, scoped to its owning business entity (such as shop ID), and compatible with previously persisted records.
- When extending a persisted shape, preserve existing fields and handle older records that do not yet contain the new optional data. Update directly related tests and documentation.

## MRP catalog and shop overrides

- All MRP reads and writes go through `MrpCatalogService`. Do not read or write the `mrpCatalog` or `mrpCatalogOverrides` collections, or the `vinoledger.mrp.*` local caches, from components.
- The `mrpCatalog` collection holds one record per brand and size, keyed by `mrpKey`. It stores `globalMrp` and `overrideGroups[{ overrideMrp, shopIds[], status: 'override' }]`. A shop's override is stored only when its price differs from `globalMrp`. A shop that matches global is removed from every group.
- Use `loadCatalog(shopId)` for a shop's effective prices. It merges global, legacy and current overrides. Use `loadCatalog()` with no shop for global.
- Never change `globalMrp` when saving, resetting or copying shop overrides. Only the global import and global edit flows may change it.
- Writing overrides:
  - One shop: `saveShopOverrides`.
  - Reset one shop: `resetShopOverrides`.
  - Reset every shop: `resetAllShopOverrides`.
  - Copy between shops: `copyShopOverrides(source, target, replaceExisting)`. Use `planShopOverrideCopy` for the preview.
  - Overview: `loadOverrideSummary(shopIds)`, with `countOverridesByShop` for per-shop counts.
- Copying overrides between shops:
  - It is a one-time snapshot, not a live link. Later edits to the source do not change the target.
  - It is admin-only.
  - The default is merge: the target keeps its own overrides and only gets source prices where it has none. Replace mode requires an explicit choice.
  - The source dropdown lists only shops that have overrides. The source and target must differ.
  - Show a warning dialog with counts before applying.
- Shop registration:
  - MRP setup defaults to Global MRP, which changes nothing.
  - Choosing Override MRP requires a source shop. Copy the overrides in the component after `registerShop` succeeds, never inside `AuthService.registerShop`.
  - If the copy fails, keep the registered shop and show a warning. Do not roll back.
- Destructive MRP actions (reset, reset all, replace-copy) use `AppDialogService` with a warning dialog that states what is affected and that it cannot be undone.


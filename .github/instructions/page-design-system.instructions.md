---
description: "Corporate premium design system for VinoLedger Angular pages: navy/champagne palette, Playfair/Inter typography, unified back/logout pattern, shared icon component, and responsive desktop/mobile layout. Apply when creating or editing any component under src/app/pages or src/app/shared."
applyTo: "src/app/pages/**,src/app/shared/**"
---

# VinoLedger Page Design System

Every page must look and behave consistently on both desktop and mobile. Follow these rules for any new or edited page.

## Brand identity

The VinoLedger corporate premium theme is based on three core colors:

- Navy: `#0B1B33`
- Champagne: `#D4B56A`
- Ivory: `#F8F6F0`

This palette defines the official app identity. Use it consistently instead of introducing custom colors per page.

## Typography

- Headings and premium brand moments: `font-family: 'Playfair Display', serif;`
- App UI, navigation, tables, forms, details: `font-family: 'Inter', sans-serif;`

Use Playfair for page titles and main dashboard headings. Use Inter for all practical business UI and numbers.
- Keep page-level H1 titles consistent across routes: `2rem`, `600` weight, `1.2` line-height, and `0` letter spacing in Playfair Display. Use `.owner-page-intro h1` in `src/styles.scss` as the reference; page-local styles must not override these title values. Reserve larger type for dedicated marketing-style hero screens only.

## Shared dropdown control

- Use `<app-select>` from `src/app/shared/select/select.component.ts` for page and shared-area dropdowns. Do not add new native `<select>` elements.
- Import `AppSelectComponent` and `AppSelectOption` into standalone components, expose typed option arrays, and preserve the page's existing `[(ngModel)]`, change handlers, disabled state, and loading/empty behavior.
- Keep the themed overlay styling in `src/styles.scss` through the shared `vl-select-field` and `vl-select-panel` classes. Do not create page-local dropdown overlays or duplicate Material select styling.
- Verify each migrated dropdown at approximately 1280px and 375px widths. Confirm the trigger, opened overlay, selected option, disabled state, and long option labels remain readable without horizontal overflow.

## Shared date control

- Use the shared `<app-date-input>` component from `src/app/shared/date-input/date-input.component.ts` for every date field instead of native browser date inputs.
- The shared control must use Angular Material `MatDatepicker` so the calendar popup is consistent across browsers; do not use native `type="date"` controls.
- Keep the existing page logic intact: preserve `[(ngModel)]`, `ngModelChange`, `min`, `max`, `disabled`, and validation checks without rewriting business rules.
- Import `AppDateInputComponent` in the standalone page's `imports` array so Angular recognizes all bound inputs and preserves functionality.
- Date constraints default to the active shop's opening date as `min` and the user's local current date as `max`. Admin flows that select a shop must bind that selected shop's opening date; shop registration's opening-date field is exempt from the minimum but still capped at today.
- Empty date controls must show a useful contextual placeholder (for example, `From date` and `To date`) and remain read-only so dates are selected from the calendar. Use the Material toggle as the only calendar icon; do not wrap the control in a label or add a second decorative calendar icon.
- Treat the field as a shared app control, not a page-local override: keep one consistent look, mobile-safe sizing, and focus state across the app.

## Color palette

Defined as CSS custom properties in [src/styles.scss](../../src/styles.scss). Never hardcode these hex values in a component — reference the variables.

| Token | Value | Usage |
|---|---|---|
| `--vl-navy` | `#0B1B33` | Primary dark navy, sidebar, header |
| `--vl-navy-dark` | `#081426` | Deep dark surfaces |
| `--vl-navy-light` | `#14253D` | Lighter navy text/secondary surfaces |
| `--vl-champagne` | `#D4B56A` | Main accent, active states, highlights |
| `--vl-champagne-light` | `#F4E9CF` | Light accent backgrounds |
| `--vl-ivory` | `#F8F6F0` | Page background |
| `--vl-white` | `#FFFFFF` | Cards and clean surfaces |
| `--vl-text-primary` | `#14253D` | Primary text |
| `--vl-text-secondary` | `#64748B` | Secondary text |
| `--vl-border` | `#E5DED0` | Borders and dividers |
| `--vl-success` | `#3F7D5A` | Success states |
| `--vl-warning` | `#B8862D` | Warning states |
| `--vl-danger` | `#B94A48` | Error states |

## One back button, one logout button — app-wide

Do **not** invent new back/logout markup or class names (`back-dashboard`, `back-button`, custom `←`/`‹` glyphs, etc). Every page uses the global classes from `styles.scss`:

```html
<button type="button" class="app-back-btn" (click)="goBack()">
  <app-icon name="chevron-left"></app-icon>
  <span>Back</span>
</button>

<button type="button" class="app-logout-btn" (click)="logout()">
  <app-icon name="logout"></app-icon>
  <span>Logout</span>
</button>
```

- Only use `app-back-btn` for real navigation-away actions (back to dashboard/previous list). Modal "Cancel"/"×" close controls keep their own local styling — they are not page navigation.
- Import `IconComponent` from `src/app/shared/icon/icon.component.ts` in the page's standalone `imports: []` array to use `<app-icon>`.
- Add new icon names to `IconComponent`'s icon set instead of inlining raw `<svg>` markup in a page.

## Shared App header

- The app shell renders `src/app/shared/app-header/app-header.component.ts` once on every authenticated route. Do not add page-level copies. The fixed header combines the VinoLedger mark/name, current shop or Administration context, signed-in user identity, and Logout; page titles and descriptions belong in route content.
- The app shell owns the single role-aware sidebar/mobile navigation for Owner, Cashier, and Admin. Never add page-local navigation or duplicate shop identity; route cards are shortcuts, not a second navigation system.
- Keep it responsive: one horizontal row on desktop; compact two-row arrangement on mobile without collision with the bottom navigation. The sidebar must start below the fixed header and must not repeat the Owner brand block.
- Resolve the current shop by the authenticated user's `shopId` against the real shops collection first. Prefer the saved shop name and owner details; only use local registered/session/demo records when no real shop record is available. Never let stale demo cache override a real record.
- Owner route content starts with a page-specific title and concise operational description. Do not repeat shop identity in page-level summary cards when the global header already provides it; retain cards that communicate useful operational metrics.

## Shared dialogs

- Before creating a popup, confirmation, warning, or alert, check for and reuse `src/app/shared/dialog/app-dialog.service.ts` and the app-wide `<app-dialog-host>`; do not add browser `alert()`/`confirm()` calls or page-specific dialogs for these common interactions.
- Open a dialog through `AppDialogService.show()` with a `type`, `title`, and `message`. Choose the type (`confirmation`, `warning`, `success`, `error`, or `info`) to match the situation and provide contextual `confirmText`/`cancelText` labels. Use optional detail rows for transaction or amount summaries that users must review.
- Keep the dialog host mounted once in the app shell. Extend the shared dialog API/component when a reusable capability is missing; keep one-off form workflows as page-specific UI only when they need editable controls rather than a common message or decision.
- For an existing destructive or financial operation, perform its validation before opening the dialog and only persist after the dialog resolves with confirmation.

## Shared loader

- Every loading, saving or uploading state must use the shared `<app-loader>` from `src/app/shared/loader/app-loader.component.ts`. Do not create page-specific spinners, `.page-loader` blocks, or plain "Loading..." text for page-level loading.
- Pass a short `title` (for example "Loading partners...") and an optional `message`. Use the default full-screen overlay for blocking work (initial page load, saving, uploading) and `[overlay]="false"` for an inline loader inside a content area, table wrapper or route transition.
- Import `AppLoaderComponent` in the standalone component (or the module) that uses it. Extend the shared loader if a capability is missing instead of copying its styles.
- Small in-button spinners and per-value placeholders (for example a stat card showing "Loading...") are not page loaders and may stay local.

## Responsive layout

- Design mobile-first; verify the page at ~375px width and ~1280px width.
- Admin flow pages reuse [admin-page-theme.scss](../../src/app/pages/admin-dashboard/admin-page-theme.scss) as the final stylesheet in `styleUrls`; keep Admin palette, typography, controls, tables, and shared surfaces centralized there, with page SCSS reserved for page-specific layout.
- The app-root shell owns shared navigation in [app.component.html](../../src/app/app.component.html) and [app.component.scss](../../src/app/app.component.scss): the Admin role gets a desktop sidebar above `900px`, while authenticated roles get their role-specific bottom bar at or below `900px`. Navigation is hidden on login.
- Keep the Admin desktop sidebar shared across Admin routes and use real routes with active-route state. Do not add page-local Admin sidebars or bottom bars.
- Keep navigation role-specific and route-aware: Owner keeps its Owner destinations; Cashier sidebar/mobile navigation contains Home, Day Sheet, Manage Partners Transactions, Stock, and Profile; Admin keeps Admin destinations. Cashier Invoice Entry and Opening Stock remain accessible through date-selected sheet setup.
- Do not add page-local bottom navigation. Remove or avoid duplicate bars so every mobile route displays one shared bar; use the shared icon component and preserve active-route semantics.
- Reserve bottom space for the fixed mobile bar, including the device safe area, so page actions and content are not obscured. Do not add this spacer on desktop.
- Use the `900px` breakpoint for desktop/mobile layout changes. The shared Admin desktop sidebar is not replaced by its mobile bottom bar; other desktop navigation should follow the owning page's existing app-shell pattern.
- Back buttons are a mobile-only pattern for the web app. Hide `.app-back-btn` on desktop layouts (`min-width: 901px`) so the web experience relies on the shell navigation and desktop header actions instead of duplicate mobile back controls.
- Reference [cashier-home.component.scss](../../src/app/pages/cashier-home/cashier-home.component.scss) for touch-friendly controls and mobile content layout, and [owner-dashboard.component.scss](../../src/app/pages/owner-dashboard/owner-dashboard.component.scss) for owner dashboard styling. The shared mobile navigation itself is owned by the app root, not either page.
- Keep touch targets at least 40px high on mobile and avoid horizontal overflow.

## Checklist for a new page

1. Header uses a dark navy surface with premium champagne accents and the unified back/logout button(s).
2. Body content sits on `--vl-ivory` with `--vl-text-primary`/`--vl-text-secondary` text.
3. Interactive accents (active nav item, highlighted card border, selected button) use `--vl-champagne`.
4. Layout collapses correctly below 900px (no horizontal scroll, tap targets ≥ 40px, no content obscured by the shared mobile navigation).
5. Reuses `<app-icon>` for iconography instead of emoji or inline SVG duplication.
6. Typography follows the premium pairing: Playfair for titles, Inter for operational UI.
7. Uses the app-root mobile navigation without adding a page-specific duplicate.

## Dropdown migration handoff

When migrating an existing page, confirm that all native dropdowns in the affected page use `<app-select>`, the Angular build passes, and at least one real option can be opened and selected in the browser. Record any blocked browser check separately, including the route, viewport, and blocking error (for example, a Firebase timeout).

---
description: "Use when changing environments, Firebase config, deployment, firestore.rules, login/auth/roles, or session timeout. Documents the dev/prod Firebase projects, how roles are resolved, the idle session and back-button behaviour, and known security gaps."
---

# Environments, deployment, auth and security notes

## Firebase projects and environments
- Dev: `vino-ledger-ff60f`, configured in `src/environments/environment.ts` (`ng serve`, dev builds).
- Production: `vino-ledger-prod`, configured in `src/environments/environment.prod.ts`. `angular.json` swaps it in via `fileReplacements` for `ng build --configuration production`.
- All Firebase access goes through `environment.firebaseConfig`. Never hardcode project config in components or services. `scripts/migrate-firestore.mjs` is the only file with its own copy, because it runs under Node.
- `.firebaserc` aliases: `dev` and `prod`. `default` is dev, so a deploy without `--project` can never hit production. Always pass `--project prod` explicitly for production.
- Deploy: `ng build --configuration production`, then `firebase deploy --project prod`. `firebase.json` hosting serves `dist/vinoledger` (Angular 18 webpack builder, no `browser` subfolder) with an SPA rewrite to `index.html`.
- A new project needs: Firestore database created, Email/Password auth enabled, the hosting domain added to Authorized domains, rules deployed, and data copied with `node scripts/migrate-firestore.mjs` (copies Firestore only, not Auth users).
- Keep all seven `firebaseConfig` fields from the same Firebase web app. Mixing values from two projects causes auth and Firestore errors.

## How login and roles work
- Firebase Auth only verifies the email and password. Roles are NOT in Firebase Auth or custom claims.
- Login (`AuthService.login`) looks the typed ID up in the `registeredAccounts` and `users` collections. These hold `{ user: { role, shopId, ... }, password }`. The role comes from that Firestore profile.
- `ensureFirebaseAuthUser` creates the Firebase Auth user on first login if it does not exist.
- For plain-email logins the role comes from `users/{uid}.role`. If that is missing, `deriveRoleFromEmail` guesses from the email text ("admin", "owner"). Do not rely on this in production.
- A new production project has no accounts. At least one `Admin` record must exist in `registeredAccounts` (copy it with the migration script, or create `registeredAccounts/<id>` by hand) before anyone can log in. Admins then register owners and cashiers in the app.
- Roles are enforced only in the client (`authGuard`, `roleGuard`, `AppComponent` navigation).

## Session management
- `AuthService` logs the user out after `SESSION_IDLE_TIMEOUT_MS` (5 minutes) without mouse, keyboard, scroll, touch or click activity. Last activity is stored in `localStorage` key `vinoledger.lastActivity`, so it is shared across tabs and checked again when the app restarts.
- `logout(navigate = true)` navigates with `replaceUrl: true`. Pass `false` to clear the session without navigating.
- `loginGuard` on the `/login` route ends any active session. This means the browser back button to the login page signs the user out, and going forward to a dashboard is then blocked by `authGuard`.
- Any new protected route must use `authGuard`.

## Known security gaps (open items before real production use)
- `firestore.rules` is currently `allow read, write: if true`. It is open to anyone who knows the project ID. Do not treat the production database as secure until this is replaced.
- Passwords are stored in plain text in Firestore (`registeredAccounts`) and in `localStorage` (`password:*`).
- Any user can edit their own `users/{uid}.role`, and nothing server-side checks roles.
- `seedRegisteredAccounts` and `seedTestData` in `auth.service.ts` add demo accounts and passwords (for example `admin123`, `40`). Disable them in production builds.
- Planned fix: set the role as a Firebase custom claim (Admin SDK or Cloud Function, needs the Blaze plan) and write rules on `request.auth.token.role` and `shopId`. Free-plan alternative: rules read `users/{uid}.role` and clients cannot write that field. Replace plain-text passwords at the same time, and rework the rules together with the login flow, because tightening the rules alone breaks the current login (it reads `registeredAccounts` before the user is signed in).

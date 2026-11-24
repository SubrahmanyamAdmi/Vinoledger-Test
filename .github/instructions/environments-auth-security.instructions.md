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
- Firebase Auth verifies the email and password. The client never compares, creates, or persists a password.
- Login accepts the user's email and authenticates with `signInWithEmailAndPassword`. It then loads a role/profile from `users/{uid}` or the profile matching the authenticated email. Missing profiles are rejected; roles are never guessed from email text.
- Admin shop registration writes shop and user profile records only. It does not create Firebase Auth users or passwords. Provision each account through a trusted Admin SDK backend, or through a controlled Firebase Console process, and use Firebase Auth password-reset emails to let users set their own password.
- Do not restore `registeredAccounts` as an authentication source. The legacy collection stored plaintext passwords and is excluded from `scripts/migrate-firestore.mjs`.
- Existing legacy Firestore `registeredAccounts` documents must be deleted separately using an authorized Firebase Admin process/console. Startup removes old `password:*` localStorage keys and strips password fields from the old local registered-account cache, but cannot delete remote Firestore data.
- Roles are enforced only in the client (`authGuard`, `roleGuard`, `AppComponent` navigation).

## Session management
- `AuthService` logs the user out after `SESSION_IDLE_TIMEOUT_MS` (5 minutes) without mouse, keyboard, scroll, touch or click activity. Last activity is stored in `localStorage` key `vinoledger.lastActivity`, so it is shared across tabs and checked again when the app restarts.
- `logout(navigate = true)` navigates with `replaceUrl: true`. Pass `false` to clear the session without navigating.
- `loginGuard` on the `/login` route ends any active session. This means the browser back button to the login page signs the user out, and going forward to a dashboard is then blocked by `authGuard`.
- Any new protected route must use `authGuard`.

## Known security gaps (open items before real production use)
- `firestore.rules` is currently `allow read, write: if true`. It is open to anyone who knows the project ID. Do not treat the production database as secure until this is replaced.
- Existing Firestore `registeredAccounts` documents may still contain plaintext passwords until explicitly deleted. Do not migrate this collection; purge it from every Firebase project and reset affected users' passwords.
- Any user can edit their own `users/{uid}.role`, and nothing server-side checks roles.
- The app does not create demo authentication accounts. Provision roles and accounts through a trusted process.
- Planned fix: set the role as a Firebase custom claim (Admin SDK or Cloud Function, needs the Blaze plan) and write rules on `request.auth.token.role` and `shopId`. Free-plan alternative: rules read `users/{uid}.role` and clients cannot write that field. Complete this together with a trusted account-provisioning backend before production.

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

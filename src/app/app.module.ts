import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';

import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { GenrateDaySheetComponent } from './genrate-day-sheet/genrate-day-sheet.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    LoginComponent,
    GenrateDaySheetComponent
  ],
  providers: [
    provideAnimationsAsync()
  ],
  exports: [AppRoutingModule],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {
    initializeApp(environment.firebaseConfig);

    const auth = getAuth();
    signInAnonymously(auth).catch(() => undefined);
  }
}

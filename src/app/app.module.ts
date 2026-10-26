import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { initializeApp } from 'firebase/app';

import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { GenrateDaySheetComponent } from './genrate-day-sheet/genrate-day-sheet.component';
import { IconComponent } from './shared/icon/icon.component';
import { AppHeaderComponent } from './shared/app-header/app-header.component';
import { AppDialogHostComponent } from './shared/dialog/app-dialog-host.component';
import { AppLoaderComponent } from './shared/loader/app-loader.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    LoginComponent,
    GenrateDaySheetComponent,
    IconComponent,
    AppHeaderComponent,
    AppDialogHostComponent,
    AppLoaderComponent
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
  }
}

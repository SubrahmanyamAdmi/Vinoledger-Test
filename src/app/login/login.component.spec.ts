import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['login', 'userRole']);
    authSpy.login.and.returnValue(of({ token: 'token', user: { role: 'Owner' } }));
    authSpy.userRole.and.returnValue('Owner');

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

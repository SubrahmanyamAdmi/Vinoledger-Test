import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { getApps, initializeApp } from 'firebase/app';
import * as firestore from 'firebase/firestore';

import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    if (!getApps().length) {
      initializeApp(environment.firebaseConfig);
    }

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: UserService, useValue: { saveUserProfile: jasmine.createSpy('saveUserProfile') } }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should clear stale cached shops when Firestore data has been reset', async () => {
    localStorage.setItem('vinoledger.registered.shops', JSON.stringify([{ shopId: 'OLD-123', name: 'Old Shop' }]));
    spyOn<any>(service as any, 'isFirebaseConfigured').and.returnValue(true);
    spyOn(firestore, 'getDocs').and.resolveTo({ docs: [] } as any);

    const shops = await service.refreshRegisteredShopsFromFirestore();

    expect(shops).toEqual([]);
    expect(JSON.parse(localStorage.getItem('vinoledger.registered.shops') || '[]')).toEqual([]);
  });
});

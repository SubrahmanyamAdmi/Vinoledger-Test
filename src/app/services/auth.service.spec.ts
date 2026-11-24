import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { getApps, initializeApp } from 'firebase/app';

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
    spyOn<any>(service as any, 'fetchRegisteredShopDocuments').and.resolveTo({ docs: [] } as any);

    const shops = await service.refreshRegisteredShopsFromFirestore();

    expect(shops).toEqual([]);
    expect(JSON.parse(localStorage.getItem('vinoledger.registered.shops') || '[]')).toEqual([]);
  });

  it('removes legacy plaintext passwords and cached auth tokens', () => {
    const account = { user: { email: 'owner@example.com', role: 'Owner' }, password: 'legacy-password' };
    localStorage.setItem('password:owner@example.com', 'legacy-password');
    localStorage.setItem('token', 'legacy-token');
    localStorage.setItem('vinoledger.registered.accounts', JSON.stringify([account]));

    (service as any).removeLegacyPasswordStorage();

    expect(localStorage.getItem('password:owner@example.com')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(JSON.parse(localStorage.getItem('vinoledger.registered.accounts') || '[]'))
      .toEqual([{ user: account.user }]);
  });
});

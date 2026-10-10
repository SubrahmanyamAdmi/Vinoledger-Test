import { TestBed } from '@angular/core/testing';

import { roleGuard } from './role.guard.guard';

describe('roleGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(roleGuard).toBeTruthy();
  });
});

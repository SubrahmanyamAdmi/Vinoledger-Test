import { fakeAsync, tick } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { BusinessDataService } from './business-data.service';

describe('BusinessDataService', () => {
  it('falls back to an empty shop list when the Firebase shops request never resolves', fakeAsync(() => {
    const firestore = jasmine.createSpyObj('FirestoreService', ['getCollection']);
    const localDatabase = jasmine.createSpyObj('LocalDatabaseService', ['getCollection']);

    firestore.getCollection.and.returnValue(new Observable(() => undefined));
    localDatabase.getCollection.and.returnValue(of([]));

    const service = new BusinessDataService(firestore, localDatabase);
    let emitted = false;
    let shops: any[] = [];

    service.getShops().subscribe((result) => {
      emitted = true;
      shops = result;
    });

    tick(8001);

    expect(emitted).toBeTrue();
    expect(shops).toEqual([]);
  }));

  it('falls back to an empty user list when the Firebase users request never resolves', fakeAsync(() => {
    const firestore = jasmine.createSpyObj('FirestoreService', ['getCollection']);
    const localDatabase = jasmine.createSpyObj('LocalDatabaseService', ['getCollection']);

    firestore.getCollection.and.returnValue(new Observable(() => undefined));
    localDatabase.getCollection.and.returnValue(of([]));

    const service = new BusinessDataService(firestore, localDatabase);
    let emitted = false;
    let users: any[] = [];

    service.getUsers().subscribe((result) => {
      emitted = true;
      users = result;
    });

    tick(8001);

    expect(emitted).toBeTrue();
    expect(users).toEqual([]);
  }));

  it('falls back to an empty day sheet list when the Firebase day sheets request never resolves', fakeAsync(() => {
    const firestore = jasmine.createSpyObj('FirestoreService', ['getCollection']);
    const localDatabase = jasmine.createSpyObj('LocalDatabaseService', ['getCollection']);

    firestore.getCollection.and.returnValue(new Observable(() => undefined));
    localDatabase.getCollection.and.returnValue(of([]));

    const service = new BusinessDataService(firestore, localDatabase);
    let emitted = false;
    let sheets: any[] = [];

    service.getDaySheets().subscribe((result) => {
      emitted = true;
      sheets = result;
    });

    tick(8001);

    expect(emitted).toBeTrue();
    expect(sheets).toEqual([]);
  }));
});

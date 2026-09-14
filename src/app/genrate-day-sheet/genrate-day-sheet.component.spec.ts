import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenrateDaySheetComponent } from './genrate-day-sheet.component';

describe('GenrateDaySheetComponent', () => {
  let component: GenrateDaySheetComponent;
  let fixture: ComponentFixture<GenrateDaySheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenrateDaySheetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenrateDaySheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

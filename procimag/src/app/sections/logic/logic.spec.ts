import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Logic } from './logic';

describe('Logic', () => {
  let component: Logic;
  let fixture: ComponentFixture<Logic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Logic]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Logic);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

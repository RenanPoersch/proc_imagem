import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Geometric } from './geometric';

describe('Geometric', () => {
  let component: Geometric;
  let fixture: ComponentFixture<Geometric>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Geometric]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Geometric);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

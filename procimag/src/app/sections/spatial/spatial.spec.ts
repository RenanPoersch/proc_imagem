import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Spatial } from './spatial';

describe('Spatial', () => {
  let component: Spatial;
  let fixture: ComponentFixture<Spatial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Spatial]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Spatial);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Morfologic } from './morfologic';

describe('Morfologic', () => {
  let component: Morfologic;
  let fixture: ComponentFixture<Morfologic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Morfologic]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Morfologic);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

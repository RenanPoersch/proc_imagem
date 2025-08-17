import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Aritmetica } from './aritmetica';

describe('Aritmetica', () => {
  let component: Aritmetica;
  let fixture: ComponentFixture<Aritmetica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Aritmetica]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Aritmetica);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

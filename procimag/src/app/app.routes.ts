import { Routes } from '@angular/router';
import { Filtros } from './sections/filtros/filtros';
import { Aritmetica } from './sections/aritmetica/aritmetica';

export const routes: Routes = [
  { path: '', redirectTo: 'filtros', pathMatch: 'full' },
  { path: 'filtros', component: Filtros },
  { path: 'aritmetica', component: Aritmetica },
];

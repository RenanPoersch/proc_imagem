import { Routes } from '@angular/router';
import { Dados } from './core/dados/dados';
import { Aritmetica } from './sections/aritmetica/aritmetica';

export const routes: Routes = [
  { path: '', redirectTo: 'dados', pathMatch: 'full' },
  { path: 'dados', component: Dados },
  { path: 'aritmetica', component: Aritmetica },
];

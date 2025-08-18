import { Routes } from '@angular/router';
import { Dados } from './core/dados/dados';
import { Aritmetica } from './sections/aritmetica/aritmetica';
import { Color } from './sections/color/color';
import { Spatial } from './sections/spatial/spatial';
import { Morfologic } from './sections/morfologic/morfologic';
import { Logic } from './sections/logic/logic';
import { Geometric } from './sections/geometric/geometric';

export const routes: Routes = [
  { path: '', redirectTo: 'dados', pathMatch: 'full' },
  { path: 'dados', component: Dados },
  { path: 'aritmetica', component: Aritmetica },
  { path: 'color', component: Color },
  { path: 'spatial', component: Spatial },
  { path: 'morfologic', component: Morfologic },
  { path: 'logic', component: Logic },
  { path: 'geometric', component: Geometric },
];

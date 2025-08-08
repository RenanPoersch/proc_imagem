import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Filtros } from './sections/filtros/filtros';
// import { TransformacoesComponent } from './sections/transformacoes/transformacoes.component';
// import { SegmentacaoComponent } from './sections/segmentacao/segmentacao.component';
// import { MorfologiaComponent } from './sections/morfologia/morfologia.component';

export const routes: Routes = [
  { path: '', redirectTo: 'filtros', pathMatch: 'full' },
  { path: 'filtros', component: Filtros },
//   { path: 'transformacoes', component: TransformacoesComponent },
//   { path: 'segmentacao', component: SegmentacaoComponent },
//   { path: 'morfologia', component: MorfologiaComponent },
//   { path: '**', redirectTo: 'filtros' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { bindToComponentInputs: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}

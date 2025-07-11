import { Routes } from '@angular/router';
import { CheckpointComponent } from './components/checkpoint/checkpoint.component';
import { ItemListComponent } from './components/item-list/item-list.component';
import { SyncComponent } from './components/sync/sync.component';

export const routes: Routes = [
  { path: '', redirectTo: 'items-list', pathMatch: 'full' },
  { path: 'items-list', component: ItemListComponent },
  { path: 'checkpoint', component: CheckpointComponent },
  { path: 'checkpoint/:id', component: CheckpointComponent },
  { 
    path: 'print-qr-code', 
    loadComponent: () => import('./components/qr-print/qr-print.component').then(m => m.QrPrintComponent)
  },
  { path: 'sync', component: SyncComponent }
];

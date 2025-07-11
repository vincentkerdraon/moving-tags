import { CommonModule, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';
import { SyncService } from '../../services/sync.service';

@Component({
  selector: 'app-sync',
  templateUrl: './sync.component.html',
  standalone: true,
  imports: [CommonModule, DatePipe]
})
export class SyncComponent {
  constructor(
    public syncService: SyncService,
    public itemService: ItemService,
    public imageService: ImageService
  ) {}

  get allClients(): string[] {
    const clients = new Set([
      ...this.itemService.itemDeltas.map(d => d.client),
      ...Object.keys(this.syncService.lastSync),
      SyncService.FAKE_CLIENT_ID
    ]);
    clients.delete(this.syncService.clientId);
    return Array.from(clients);
  }

  getPhotoCount(clientId: string): number {
    // Count photos added by this client since last sync
    const lastSync = this.syncService.lastSync[clientId] || new Date(0);
    return this.itemService.itemDeltas.filter(d => d.client === clientId && d.time > lastSync && d.photosAdded).reduce((sum, d) => sum + (d.photosAdded?.length || 0), 0);
  }

  getItemChangeCount(clientId: string): number {
    // Count item changes by this client since last sync
    const lastSync = this.syncService.lastSync[clientId] || new Date(0);
    return this.itemService.itemDeltas.filter(d => d.client === clientId && d.time > lastSync).length;
  }
}

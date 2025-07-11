import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';
import { SyncService } from '../../services/sync.service';
import { WebRTCService } from '../../services/webrtc.service';
import { WebrtcQrCodeComponent } from '../webrtc-qr-code/webrtc-qr-code.component';

@Component({
  selector: 'app-sync',
  templateUrl: './sync.component.html',
  standalone: true,
  imports: [CommonModule, DatePipe,  WebrtcQrCodeComponent]
})
export class SyncComponent { 
  constructor(
    public syncService: SyncService,
    public itemService: ItemService,
    public imageService: ImageService,
    public webrtc: WebRTCService,
    private cdr: ChangeDetectorRef
  ) {}

  onShowConnect() {
    this.syncService.showConnect = !this.syncService.showConnect;
    if (this.syncService.showConnect && !this.syncService.connectionStarted) {
      this.syncService.startConnection(() => this.cdr.detectChanges());
    }
  }

  copyRawOffer() {
    if (this.syncService.rawOffer) {
      navigator.clipboard.writeText(this.syncService.rawOffer);
    }
  }

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

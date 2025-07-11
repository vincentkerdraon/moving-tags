import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';
import { SyncConnectionStatus, SyncService } from '../../services/sync.service';
import { WebRTCService } from '../../services/webrtc.service';
import { WebrtcQrCodeComponent } from '../webrtc-qr-code/webrtc-qr-code.component';

@Component({
  selector: 'app-sync',
  templateUrl: './sync.component.html',
  standalone: true,
  imports: [CommonModule, DatePipe,  WebrtcQrCodeComponent, ZXingScannerModule, FormsModule]
})
export class SyncComponent { 
  mode: 'default' | 'server' | 'client' = 'default';
  scannedQr: string | null = null;
  pastedOffer: string = '';
  clientAnswer: string | null = null;
  serverAnswerInput: string = ''; 

  public SyncConnectionStatus = SyncConnectionStatus;

  constructor(
    public syncService: SyncService,
    public itemService: ItemService,
    public imageService: ImageService,
    public webrtc: WebRTCService,
    private cdr: ChangeDetectorRef
  ) {}

  startServer() {
    this.mode = 'server';
    this.syncService.showConnect = true;
    if (!this.syncService.connectionStarted) {
      this.syncService.startServerConnection(() => this.cdr.detectChanges());
    }
  }

  connectToServer() {
    this.mode = 'client';
    this.syncService.showConnect = true;
    // Placeholder: implement QR scan logic here
  }

  cancelSync() {
    this.mode = 'default';
    this.syncService.showConnect = false;
    this.syncService.reset();
    this.webrtc.reset();
    this.scannedQr = null;
    this.pastedOffer = '';
    this.clientAnswer = null;
    this.serverAnswerInput = '';
  }

  onShowConnect() {
    this.syncService.showConnect = !this.syncService.showConnect;
    if (this.syncService.showConnect && !this.syncService.connectionStarted) {
      this.syncService.startServerConnection(() => this.cdr.detectChanges());
    }
  }

  copyRawOffer() {
    if (this.syncService.rawOffer) {
      console.log('[SyncComponent] Copying raw offer to clipboard:', this.syncService.rawOffer);
      
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.syncService.rawOffer).then(() => {
          console.log('[SyncComponent] Raw offer copied to clipboard successfully');
          // TODO: Show success message to user
        }).catch(err => {
          console.error('[SyncComponent] Failed to copy to clipboard:', err);
          if (this.syncService.rawOffer) {
            this.fallbackCopyToClipboard(this.syncService.rawOffer);
          }
        });
      } else {
        console.warn('[SyncComponent] Clipboard API not available, using fallback');
        if (this.syncService.rawOffer) {
          this.fallbackCopyToClipboard(this.syncService.rawOffer);
        }
      }
    }
  }

  copyClientAnswer() {
    if (this.clientAnswer) {
      console.log('[SyncComponent] Copying client answer to clipboard:', this.clientAnswer);
      
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(this.clientAnswer).then(() => {
          console.log('[SyncComponent] Client answer copied to clipboard successfully');
        }).catch(err => {
          console.error('[SyncComponent] Failed to copy client answer to clipboard:', err);
          if (this.clientAnswer) {
            this.fallbackCopyToClipboard(this.clientAnswer);
          }
        });
      } else {
        console.warn('[SyncComponent] Clipboard API not available, using fallback');
        if (this.clientAnswer) {
          this.fallbackCopyToClipboard(this.clientAnswer);
        }
      }
    }
  }

  private fallbackCopyToClipboard(text: string) {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('[SyncComponent] Raw offer copied using fallback method');
      } else {
        console.error('[SyncComponent] Fallback copy failed');
      }
    } catch (err) {
      console.error('[SyncComponent] Fallback copy error:', err);
    }
    
    document.body.removeChild(textarea);
  }

  onQrCodeResult(result: string) {
    this.scannedQr = result;
    this.handleProcessOffer(result);
    this.cdr.detectChanges();
  }

  onProcessPastedOffer() {
    if (this.pastedOffer.trim()) {
      this.handleProcessOffer(this.pastedOffer.trim());
    }
  }

  private async handleProcessOffer(data: string) {
    try {
      console.log('[SyncComponent] Processing offer data via service...');
      const clientAnswer = await this.syncService.processOfferDataAsClient(data, () => this.cdr.detectChanges());
      this.clientAnswer = clientAnswer;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('[SyncComponent] Failed to process offer data:', error);
      this.syncService.connectionStatus = SyncConnectionStatus.Client_Failed;
      this.cdr.detectChanges();
    }
  }

  async processClientAnswer() {
    if (this.serverAnswerInput.trim()) {
      try {
        console.log('[SyncComponent] Processing client answer via service...');
        await this.syncService.processClientAnswerAsServer(this.serverAnswerInput.trim());
        this.cdr.detectChanges();
      } catch (error) {
        console.error('[SyncComponent] Failed to process client answer:', error);
        this.syncService.connectionStatus = SyncConnectionStatus.Server_Failed;
        this.cdr.detectChanges();
      }
    }
  }



  checkConnectionState() {
    console.log('[SyncComponent] Connection state check:');
    console.log('- WebRTC service:', this.webrtc);
    console.log('- Sync service connection status:', this.syncService.connectionStatus);
    // We'll need to add a method to WebRTCService to get the current state
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


  getStatusInfo(): { label: string; badge: string } {
    const status = this.syncService.connectionStatus;
    switch (status) {
      case SyncConnectionStatus.Server_Connected:
      case SyncConnectionStatus.Client_Connected:
        return { label: 'Connected', badge: 'success' };
      case SyncConnectionStatus.Server_WaitingForAnswer:
        return { label: 'Waiting for other device...', badge: 'warning' };
      case SyncConnectionStatus.Server_GeneratingOffer:
        return { label: 'Preparing connection...', badge: 'secondary' };
      case SyncConnectionStatus.Client_CreatingAnswer:
        return { label: 'Processing connection...', badge: 'secondary' };
      case SyncConnectionStatus.Client_AnswerCreated:
        return { label: 'Ready! Copy this code to the other device', badge: 'info' };
      case SyncConnectionStatus.Server_AnswerProcessed:
        return { label: 'Almost there! Waiting for connection...', badge: 'info' };
      case SyncConnectionStatus.Server_Failed:
      case SyncConnectionStatus.Client_Failed:
        return { label: 'Error', badge: 'danger' };
      case SyncConnectionStatus.NotConnected:
        return { label: 'Not connected', badge: 'secondary' };
      default:
        return { label: String(status), badge: 'secondary' };
    }
  }
}

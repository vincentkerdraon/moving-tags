
import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';
import { SyncConnectionStatus, SyncService } from '../../services/sync.service';
import { WebRTCService } from '../../services/webrtc.service';
import { WebrtcQrCodeComponent } from '../webrtc-qr-code/webrtc-qr-code.component';

@Component({
  selector: 'app-sync',
  templateUrl: './sync.component.html',
  standalone: true,
  imports: [CommonModule, DatePipe, WebrtcQrCodeComponent, ZXingScannerModule, FormsModule]
})
export class SyncComponent {
  mode: 'default' | 'server' | 'client' = 'default';
  scannedQr: string | null = null;
  pastedOffer: string = '';
  clientAnswer: string | null = null;
  serverAnswerInput: string = '';
  errorMessage: string | null = null;

  public SyncConnectionStatus = SyncConnectionStatus;

  constructor(
    public syncService: SyncService,
    public itemService: ItemService,
    public imageService: ImageService,
    public webrtc: WebRTCService,
    private cdr: ChangeDetectorRef
  ) { }

  forceSync() {
    this.syncService.triggerSync();
    this.cdr.detectChanges();
  }

  compressAnswer(answer: string | null): string {
    if (!answer) return '';
    return compressToEncodedURIComponent(answer);
  }

  confirmDeleteAll() {
    if (confirm('Are you sure you want to delete ALL local data? This cannot be undone.')) {
      this.syncService.reset();
      this.itemService.reset();
      this.imageService.reset();
      this.mode = 'default';
      this.errorMessage = null;
      this.cdr.detectChanges();
    }
  }

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
    if (this.syncService.qrData) {
      this.copyToClipboard(this.syncService.qrData);
    }
  }

  copyClientAnswer() {
    if (this.clientAnswer) {
      this.copyToClipboard(this.clientAnswer);
    }
  }

  copyToClipboard(text: string) {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        console.log('[SyncComponent] Copied to clipboard successfully');
      }).catch(err => {
        console.error('[SyncComponent] Failed to copy to clipboard:', err);
        this.fallbackCopyToClipboard(text);
      });
    } else {
      console.warn('[SyncComponent] Clipboard API not available, using fallback');
      this.fallbackCopyToClipboard(text);
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
        console.log('[SyncComponent] Copied to clipboard using fallback method');
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
    this.errorMessage = null; // Clear any previous errors
    this.handleProcessOffer(result);
    this.cdr.detectChanges();
  }

  onScanError(error: any) {
    console.error('Sync QR Scanner: Scan error occurred:', error, typeof error, JSON.stringify(error, null, 2));
    this.errorMessage = 'Unable to scan QR code. Make sure your camera is working and the QR code is clearly visible.';
    this.cdr.detectChanges();
  }

  onScanFailure(error: any) {
    // Don't log every scan failure as it's normal when no QR code is in view
    // console.warn('Sync QR Scanner: Scan failure (no QR code detected):', error);
  }

  onScanComplete(result: any) {
    console.log('Sync QR Scanner: Scan complete event:', result);
  }

  onCamerasFound(devices: any[]) {
    console.log('Sync QR Scanner: Cameras found:', devices);
    // Clear any camera-related error messages
    if (this.errorMessage && (this.errorMessage.includes('camera') || this.errorMessage.includes('Camera'))) {
      this.errorMessage = null;
      this.cdr.detectChanges();
    }
  }

  onCamerasNotFound() {
    console.error('Sync QR Scanner: No cameras found');
    this.errorMessage = 'No cameras found. Please check camera permissions and ensure your device has a camera.';
    this.cdr.detectChanges();
  }

  onPermissionResponse(permission: boolean) {
    console.log('Sync QR Scanner: Camera permission response:', permission);
    if (!permission) {
      this.errorMessage = 'Camera permission denied. Please allow camera access to scan QR codes.';
      this.cdr.detectChanges();
    } else {
      // Clear permission-related error messages
      if (this.errorMessage && this.errorMessage.includes('permission')) {
        this.errorMessage = null;
        this.cdr.detectChanges();
      }
    }
  }

  onProcessPastedOffer() {
    if (this.pastedOffer.trim()) {
      this.errorMessage = null; // Clear any previous errors
      let data = this.pastedOffer.trim();
      // Always try to decompress, and only proceed if valid JSON after decompress
      let decompressed = decompressFromEncodedURIComponent(data);
      if (decompressed) {
        data = decompressed;
      }
      try {
        JSON.parse(data); // Validate JSON before passing on
        this.handleProcessOffer(data);
      } catch (e) {
        this.errorMessage = 'Invalid offer: please paste the code from the other device.';
      }
    }
  }

  private async handleProcessOffer(data: string) {
    try {
      console.log('[SyncComponent] Processing offer data via service...');
      const clientAnswer = await this.syncService.processOfferDataAsClient(data, () => this.cdr.detectChanges());
      this.clientAnswer = clientAnswer;
      this.errorMessage = null; // Clear error on success
      this.cdr.detectChanges();
    } catch (error) {
      console.error('[SyncComponent] Failed to process offer data:', error);
      this.syncService.connectionStatus = SyncConnectionStatus.Client_Failed;

      // Set user-friendly error message
      if (error instanceof SyntaxError) {
        this.errorMessage = 'Invalid QR code content. Please scan the correct QR code from the server device.';
      } else {
        this.errorMessage = `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }

      // Reset scan state to allow retry
      this.scannedQr = null;
      this.pastedOffer = '';

      this.cdr.detectChanges();
    }
  }

  async processClientAnswer() {
    if (this.serverAnswerInput.trim()) {
      let data = this.serverAnswerInput.trim();
      // Always try to decompress, and only proceed if valid JSON after decompress
      let decompressed = decompressFromEncodedURIComponent(data);
      if (decompressed) {
        data = decompressed;
      }
      try {
        JSON.parse(data); // Validate JSON before passing on
        console.log('[SyncComponent] Processing client answer via service...');
        await this.syncService.processClientAnswerAsServer(data);
        this.cdr.detectChanges();
      } catch (error) {
        console.error('[SyncComponent] Failed to process client answer:', error);
        this.errorMessage = 'Invalid answer: please paste the code from the other device.';
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
      SyncService.FAKE_DEVICE_ID
    ]);
    clients.delete(this.syncService.deviceId);
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

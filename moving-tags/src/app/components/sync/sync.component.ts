import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';
import { SyncService } from '../../services/sync.service';
import { WebRTCService } from '../../services/webrtc.service';
import { WebrtcQrCodeComponent } from '../webrtc-qr-code/webrtc-qr-code.component';

@Component({
  selector: 'app-sync',
  templateUrl: './sync.component.html',
  standalone: true,
  imports: [CommonModule, DatePipe, WebrtcQrCodeComponent, ZXingScannerModule, FormsModule]
})
export class SyncComponent implements OnInit {
  mode: 'default' | 'server' | 'client' = 'default';
  scannedQr: string | null = null;
  pastedOffer: string = '';
  clientAnswer: string | null = null;
  serverAnswerInput: string = '';
  errorMessage: string | null = null;
  isConnected = false;

  // UI state for QR codes and connection
  qrCodeData: string = '';

  allowedFormats = [BarcodeFormat.QR_CODE];

  constructor(
    public syncService: SyncService,
    public itemService: ItemService,
    public imageService: ImageService,
    public webrtc: WebRTCService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    console.log('[SyncComponent] Initializing...');

    // Initialize services
    this.syncService.initialize();
    this.webrtc.initialize();

    // Listen for connection state changes
    this.webrtc.onConnectionState((connected) => {
      this.isConnected = connected === 'connected';
      console.log('[SyncComponent] Connection state changed:', connected);
      this.cdr.detectChanges();
    });

    // Check current connection state
    this.isConnected = this.webrtc.isConnectionHealthy();
  }

  // === Core Actions ===

  forceSync() {
    this.syncService.triggerSync();
    this.cdr.detectChanges();
  }

  forceReconnect() {
    this.webrtc.forceReconnect();
  }

  // === Server Mode ===

  startServer() {
    console.log('[SyncComponent] Starting server...');
    this.mode = 'server';
    this.errorMessage = null;

    this.webrtc.startAsServer((offerString) => {
      // Validate offer contains at least one m= line (required for valid SDP)
      if (!/\nm=/.test('\n' + offerString)) {
        console.error('[SyncComponent] Generated offer is missing m= line! Offer:', offerString);
        this.errorMessage = 'Generated offer is invalid (missing m= line). Please try again.';
        this.qrCodeData = '';
        this.cdr.detectChanges();
        return;
      }
      // Compress the offer for QR code
      this.qrCodeData = compressToEncodedURIComponent(offerString);
      console.log('[SyncComponent] Server offer ready, QR data generated');
      this.cdr.detectChanges();
    });
  }

  // === Client Mode ===

  connectToServer() {
    this.mode = 'client';
    this.errorMessage = null;
  }

  async onProcessPastedOffer() {
    try {
      let offerData = this.pastedOffer;
      // console.log('[SyncComponent] Raw pasted offer data:', offerData);

      // Decompress if not plain SDP
      if (!offerData.startsWith('v=')) {
        const decompressed = decompressFromEncodedURIComponent(offerData);
        // console.log('[SyncComponent] Decompressed offer data:', decompressed);
        if (decompressed) {
          offerData = decompressed;
        } else {
          throw new Error('Failed to decompress offer data');
        }
      }

      // Pass SDP or JSON directly to connectAsClient
      await this.webrtc.connectAsClient(offerData, (answer) => {
        this.clientAnswer = answer;
        console.log('[SyncComponent] Client answer ready');
        this.cdr.detectChanges();
      });

    } catch (error) {
      console.error('[SyncComponent] Error processing offer:', error);
      const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
      this.errorMessage = `Failed to process offer: ${errorMessage}`;
      this.cdr.detectChanges();
    }
  }

  async onProcessServerAnswer() {
    try {
      const compressedAnswer = this.serverAnswerInput.trim();

      // Decompress the answer
      const answerData = decompressFromEncodedURIComponent(compressedAnswer);
      if (!answerData) {
        throw new Error('Failed to decompress answer data');
      }

      // Process the decompressed answer
      await this.webrtc.processAnswer(answerData);

      console.log('[SyncComponent] Server processed answer successfully');
      this.cdr.detectChanges();

    } catch (error) {
      console.error('[SyncComponent] Error processing answer:', error);
      const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
      this.errorMessage = `Failed to process answer: ${errorMessage}`;
      this.cdr.detectChanges();
    }
  }

  // === QR Code Scanning ===

  onQrCodeResult(result: string) {
    console.log('[SyncComponent] QR code scanned:', result);
    this.scannedQr = result;
    this.pastedOffer = result;
    this.onProcessPastedOffer();
  }

  // === Utility Methods ===

  compressAnswer(answer: string | null): string {
    if (!answer) return '';
    return compressToEncodedURIComponent(answer);
  }

  copyToClipboard(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        console.log('[SyncComponent] Copied to clipboard via Clipboard API');
      }).catch(err => {
        console.error('[SyncComponent] Failed to copy via Clipboard API:', err);
        this.fallbackCopyToClipboard(text);
      });
    } else {
      this.fallbackCopyToClipboard(text);
    }
  }

  private fallbackCopyToClipboard(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('[SyncComponent] Copied to clipboard via fallback method');
      } else {
        console.error('[SyncComponent] Failed to copy via fallback method');
      }
    } catch (err) {
      console.error('[SyncComponent] Error in fallback copy:', err);
    }

    document.body.removeChild(textArea);
  }

  copyQrData() {
    if (this.qrCodeData) {
      this.copyToClipboard(this.qrCodeData);
    }
  }

  copyClientAnswer() {
    if (this.clientAnswer) {
      this.copyToClipboard(this.clientAnswer);
    }
  }

  copyCompressedAnswer() {
    if (this.clientAnswer) {
      const compressed = this.compressAnswer(this.clientAnswer);
      this.copyToClipboard(compressed);
    }
  }

  // === Reset and Cleanup ===

  cancelSync() {
    console.log('[SyncComponent] Canceling sync');
    this.mode = 'default';
    this.qrCodeData = '';
    this.clientAnswer = null;
    this.errorMessage = null;
    this.pastedOffer = '';
    this.serverAnswerInput = '';
    this.scannedQr = null;
    this.webrtc.close();
    this.cdr.detectChanges();
  }

  confirmDeleteAll() {
    if (confirm('Are you sure you want to delete ALL local data? This cannot be undone.')) {
      console.log('[SyncComponent] Deleting all local data');
      this.syncService.reset();
      this.itemService.reset();
      this.imageService.reset();
      this.webrtc.reset();
      this.cancelSync();
    }
  }

  // === Status Helpers ===

  getConnectionStatus(): string {
    if (this.isConnected) {
      return 'Connected';
    }
    return 'Not connected';
  }

  canSync(): boolean {
    return this.isConnected;
  }

  canShowQr(): boolean {
    return this.mode === 'server' && !!this.qrCodeData;
  }

  canCopyAnswer(): boolean {
    return this.mode === 'client' && !!this.clientAnswer;
  }


  canProcessAnswer(): boolean {
    return this.mode === 'server' && this.serverAnswerInput.trim().length > 0;
  }


  /**
   * Returns a list of all known client device IDs, including this device and any others seen in item deltas.
   */
  get allClients(): string[] {
    // Collect all deviceIds from item deltas
    const deltas = this.itemService.itemDeltasSince(new Date(0));
    const ids = new Set<string>();
    for (const d of deltas) {
      if (d.deviceId) ids.add(d.deviceId);
    }
    // If WebRTCService has a deviceId property, include it
    if (this.webrtc && (this.webrtc as any).deviceId) {
      ids.add((this.webrtc as any).deviceId);
    }
    return Array.from(ids);
  }

  /**
   * Returns the number of item changes from other devices since the last sync for the given clientId.
   */
  getItemChangeCount(clientId: string): number {
    const lastSync = this.syncService.getLastSync?.(clientId);
    const since = (lastSync instanceof Date) ? lastSync : new Date(0);
    return this.itemService.itemDeltasSince(since).filter(d => d.deviceId !== clientId).length;
  }

  /**
   * Returns the number of photos added by the given client/device.
   */
  getPhotoCount(clientId: string): number {
    const deltas = this.itemService.itemDeltasSince(new Date(0)).filter(d => d.deviceId === clientId);
    return deltas.reduce((count, delta) => count + (Array.isArray(delta.photosAdded) ? delta.photosAdded.length : 0), 0);
  }
}

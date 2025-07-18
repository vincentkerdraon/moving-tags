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
      this.isConnected = connected;
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
      let offerData = this.pastedOffer.trim();

      // Check if offer data is JSON directly
      if (!offerData.startsWith('{')) {
        const decompressed = decompressFromEncodedURIComponent(offerData);
        if (decompressed) {
          offerData = decompressed;
        } else {
          throw new Error('Failed to decompress offer data');
        }
      }

      try {
        JSON.parse(offerData);
      } catch (error) {
        throw new Error('Invalid JSON format in offer data');
      }

      // Connect as client and get answer
      const answerString = await this.webrtc.connectAsClient(offerData, (answer) => {
        this.clientAnswer = answer;
        console.log('[SyncComponent] Client answer ready');
        this.cdr.detectChanges();
      });

      this.clientAnswer = answerString;
      this.cdr.detectChanges();

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
    } else if (this.webrtc.getConnectionState().peerConnectionState === 'connecting') {
      return 'Connecting...';
    } else if (this.mode === 'server' && this.qrCodeData) {
      return 'Waiting for client';
    } else if (this.mode === 'client' && this.clientAnswer) {
      return 'Waiting for server';
    } else {
      return 'Not connected';
    }
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

  get allClients(): string[] {
    const lastSync = this.webrtc.getLastSync();
    const deviceId = this.webrtc.getDeviceId();
    const clients = new Set([deviceId, ...Object.keys(lastSync)]);
    return Array.from(clients);
  }

  getPhotoCount(clientId: string): number {
    const lastSync = this.webrtc.getLastSync();
    const since = lastSync[clientId] || new Date(0);
    const deltas = this.itemService.itemDeltasSince(since).filter(d => d.client === clientId);
    return deltas.reduce((count, delta) => count + (delta.photosAdded?.length || 0), 0);
  }

  getItemChangeCount(clientId: string): number {
    const lastSync = this.webrtc.getLastSync();
    const since = lastSync[clientId] || new Date(0);
    return this.itemService.itemDeltasSince(since).filter(d => d.client !== clientId).length;
  }
}

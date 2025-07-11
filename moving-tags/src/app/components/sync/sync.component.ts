import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';
import { SyncService } from '../../services/sync.service';
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
  clientAnswer: string | null = null; // Add this to store the client's answer
  serverAnswerInput: string = ''; // Add this for server to accept client answer
  testMessage: string = '';

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
      this.syncService.startConnection(() => this.cdr.detectChanges());
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
    // Optionally reset other syncService state if needed
  }

  onShowConnect() {
    this.syncService.showConnect = !this.syncService.showConnect;
    if (this.syncService.showConnect && !this.syncService.connectionStarted) {
      this.syncService.startConnection(() => this.cdr.detectChanges());
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
    this.processOfferData(result);
    this.cdr.detectChanges();
  }

  onProcessPastedOffer() {
    if (this.pastedOffer.trim()) {
      this.processOfferData(this.pastedOffer.trim());
    }
  }

  private processOfferData(data: string) {
    try {
      console.log('[SyncComponent] Starting to process offer data...');
      // Try to decompress if it's compressed
      let offerData = data;
      if (data.startsWith('N4Ig') || data.includes('%')) {
        console.log('[SyncComponent] Data appears compressed, decompressing...');
        // Looks like compressed data, try to decompress
        offerData = decompressFromEncodedURIComponent(data) || data;
        console.log('[SyncComponent] Decompressed data length:', offerData.length);
      }
      
      const parsed = JSON.parse(offerData);
      console.log('[SyncComponent] Processing offer:', parsed);
      
      // Create peer connection as client (non-initiator)
      console.log('[SyncComponent] Creating client peer connection...');
      this.webrtc.createPeerConnection((candidate) => {
        console.log('[SyncComponent] Client ICE candidate:', candidate);
      }, false);
      
      // Set the signaling data (offer/answer/candidates)
      console.log('[SyncComponent] Setting signaling data on client...');
      this.webrtc.setSignalingData(parsed).then(async () => {
        console.log('[SyncComponent] Signaling data set successfully');
        this.syncService.connectionStatus = 'Creating answer...';
        
        // Create and send answer back to server
        if (parsed.offer) {
          try {
            const answer = await this.webrtc.createAnswer(parsed.offer);
            console.log('[SyncComponent] Answer created:', answer);
            this.syncService.connectionStatus = 'Answer created - copy to server';
            
            // Store the answer for copying to server
            const answerData = {
              answer: answer,
              candidates: this.webrtc.getSignalingData().candidates
            };
            this.clientAnswer = JSON.stringify(answerData, null, 2);
            console.log('[SyncComponent] Answer for server:', this.clientAnswer);
            
          } catch (error) {
            console.error('[SyncComponent] Failed to create answer:', error);
            this.syncService.connectionStatus = 'Failed to create answer';
          }
        }
        
        this.cdr.detectChanges();
      }).catch(error => {
        console.error('[SyncComponent] Failed to set signaling data:', error);
        this.syncService.connectionStatus = 'Failed to set signaling data';
        this.cdr.detectChanges();
      });
      
      // Set up message handler
      this.webrtc.onMessage(msg => {
        this.syncService.connectionStatus = 'Connected!';
        console.log('[SyncComponent] Data channel message received:', msg);
        this.cdr.detectChanges();
      });
      
    } catch (error) {
      console.error('[SyncComponent] Failed to process offer data:', error);
      this.syncService.connectionStatus = 'Failed to process offer';
      this.cdr.detectChanges();
    }
  }

  processClientAnswer() {
    if (this.serverAnswerInput.trim()) {
      try {
        console.log('[SyncComponent] Processing client answer...');
        const answerData = JSON.parse(this.serverAnswerInput.trim());
        console.log('[SyncComponent] Client answer data:', answerData);
        
        // Set the answer and candidates on the server's WebRTC connection
        this.webrtc.setSignalingData(answerData).then(() => {
          console.log('[SyncComponent] Client answer processed successfully');
          this.syncService.connectionStatus = 'Answer processed, establishing connection...';
          this.cdr.detectChanges();
        }).catch(error => {
          console.error('[SyncComponent] Failed to process client answer:', error);
          this.syncService.connectionStatus = 'Failed to process answer';
          this.cdr.detectChanges();
        });
        
      } catch (error) {
        console.error('[SyncComponent] Failed to parse client answer:', error);
        this.syncService.connectionStatus = 'Invalid answer format';
        this.cdr.detectChanges();
      }
    }
  }

  sendTestMessage() {
    if (this.testMessage.trim()) {
      console.log('[SyncComponent] Attempting to send test message:', this.testMessage);
      const connectionState = this.webrtc.getConnectionState();
      console.log('[SyncComponent] Connection state:', connectionState);
      
      try {
        this.webrtc.sendMessage(this.testMessage);
        console.log('[SyncComponent] Message sent successfully');
        this.testMessage = '';
      } catch (error) {
        console.error('[SyncComponent] Failed to send message:', error);
      }
    } else {
      console.log('[SyncComponent] No message to send');
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

  isConnectionReady(): boolean {
    // Allow message input for all statuses indicating a ready connection
    const status = this.syncService.connectionStatus;
    return status === 'Connected!'
      || status === 'Answer processed, establishing connection...'
      || status === 'Answer created - copy to server';
  }

  getStatusInfo(): { label: string; badge: string } {
    const status = this.syncService.connectionStatus;
    if (status === 'Connected!') {
      return { label: 'Connected', badge: 'success' };
    }
    if (status === 'Waiting for answer...') {
      return { label: 'Waiting for other device...', badge: 'warning' };
    }
    if (status === 'Generating offer...') {
      return { label: 'Preparing connection...', badge: 'secondary' };
    }
    if (status === 'Creating answer...') {
      return { label: 'Processing connection...', badge: 'secondary' };
    }
    if (status === 'Answer created - copy to server') {
      return { label: 'Ready! Copy this code to the other device', badge: 'info' };
    }
    if (status === 'Answer processed, establishing connection...') {
      return { label: 'Almost there! Waiting for connection...', badge: 'info' };
    }
    if (status.startsWith('Failed')) {
      return { label: 'Error: ' + status.replace('Failed', '').trim(), badge: 'danger' };
    }
    return { label: status, badge: 'secondary' };
  }
}

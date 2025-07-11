import { Injectable } from '@angular/core';
import { compressToEncodedURIComponent } from 'lz-string';
import { WebRTCService } from './webrtc.service';

export type SyncClientId = string;

@Injectable({ providedIn: 'root' })
export class SyncService {
  static readonly CLIENT_ID_KEY = 'clientId';
  static readonly LAST_SYNC_KEY = 'lastSync';
  static readonly FAKE_CLIENT_ID = 'FAKE_CLIENT_FOR_DISPLAY';

  public clientId: SyncClientId;
  public lastSync: Record<SyncClientId, Date> = {};

  // --- SyncComponent stateful data ---
  public showConnect = false;
  public connectionStarted = false;
  public connectionStatus = 'Not connected';
  public rawOffer: string | null = null;
  public qrData: string | null = null;

  constructor(
    public webrtc: WebRTCService
  ) {
    const storedClientId = localStorage.getItem(SyncService.CLIENT_ID_KEY);
    if (storedClientId) {
      this.clientId = storedClientId;
    } else {
      this.clientId = this.generateClientId();
      localStorage.setItem(SyncService.CLIENT_ID_KEY, this.clientId);
    }
    const storedLastSync = localStorage.getItem(SyncService.LAST_SYNC_KEY);
    if (storedLastSync) {
      try {
        const parsed = JSON.parse(storedLastSync);
        for (const k in parsed) {
          this.lastSync[k] = new Date(parsed[k]);
        }
      } catch {}
    }
  }

  startConnection(afterUpdate?: () => void) {
    this.connectionStarted = true;
    this.connectionStatus = 'Generating offer...';
    console.log('[SyncService] Starting WebRTC connection as initiator');
    
    let iceCandidatesComplete = false;
    
    this.webrtc.createPeerConnection((candidate) => {
      console.log('[SyncService] ICE candidate:', candidate);
      // Generate QR code after getting some ICE candidates
      if (!iceCandidatesComplete) {
        setTimeout(() => {
          const raw = JSON.stringify(this.webrtc.getSignalingData(), null, 2);
          this.rawOffer = raw;
          this.qrData = compressToEncodedURIComponent(raw);
          this.connectionStatus = 'Waiting for answer...';
          console.log('[SyncService] Updated QR data with ICE candidates:', raw);
          if (afterUpdate) afterUpdate();
        }, 100); // Small delay to allow multiple candidates
      }
    }, true);
    
    // Always set the onMessage handler immediately after creating the data channel
    const dataChannel = this.webrtc.createDataChannel();
    this.webrtc.setupDataChannel(dataChannel, () => {
      this.connectionStatus = 'Connected!';
      if (afterUpdate) afterUpdate();
    });
    this.webrtc.onMessage(msg => {
      // Only log message, connectionStatus is now set on open
      console.log('[SyncService] Data channel message:', msg);
      if (afterUpdate) afterUpdate();
    });
    this.webrtc.createOffer().then(() => {
      console.log('[SyncService] Offer created, waiting for ICE candidates...');
      
      // Set a timeout to generate QR code even if no ICE candidates come
      setTimeout(() => {
        if (!this.qrData) {
          const raw = JSON.stringify(this.webrtc.getSignalingData(), null, 2);
          this.rawOffer = raw;
          this.qrData = compressToEncodedURIComponent(raw);
          this.connectionStatus = 'Waiting for answer...';
          console.log('[SyncService] QR code generated (timeout), QR data:', raw);
          if (afterUpdate) afterUpdate();
        }
        iceCandidatesComplete = true;
      }, 3000); // Wait up to 3 seconds for ICE candidates
    });
  }

  private generateClientId(): SyncClientId {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  setLastSync(clientId: SyncClientId, date: Date) {
    this.lastSync[clientId] = date;
    localStorage.setItem(SyncService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
  }
}

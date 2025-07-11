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
    this.webrtc.createPeerConnection((candidate) => {
      console.log('[SyncService] ICE candidate:', candidate);
    }, true);
    this.webrtc.createDataChannel();
    this.webrtc.createOffer().then(() => {
      const raw = JSON.stringify(this.webrtc.getSignalingData(), null, 2);
      this.rawOffer = raw;
      this.qrData = compressToEncodedURIComponent(raw);
      this.connectionStatus = 'Waiting for answer...';
      console.log('[SyncService] Offer created, QR data:', raw);
      console.log('[SyncService] QR code generated');
      if (afterUpdate) afterUpdate();
    });
    this.webrtc.onMessage(msg => {
      this.connectionStatus = 'Connected!';
      console.log('[SyncService] Data channel message:', msg);
      if (afterUpdate) afterUpdate();
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

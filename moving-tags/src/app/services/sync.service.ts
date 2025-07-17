import { Injectable } from '@angular/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { WebRTCService } from './webrtc.service';

export type SyncClientId = string;

export enum SyncConnectionStatus {
  NotConnected = 'NOT_CONNECTED',
  Server_GeneratingOffer = 'SERVER_GENERATING_OFFER',
  Server_WaitingForAnswer = 'SERVER_WAITING_FOR_ANSWER',
  Server_AnswerProcessed = 'SERVER_ANSWER_PROCESSED',
  Server_Connected = 'SERVER_CONNECTED',
  Server_Failed = 'SERVER_FAILED',
  Client_WaitingForOffer = 'CLIENT_WAITING_FOR_OFFER',
  Client_CreatingAnswer = 'CLIENT_CREATING_ANSWER',
  Client_AnswerCreated = 'CLIENT_ANSWER_CREATED',
  Client_Connected = 'CLIENT_CONNECTED',
  Client_Failed = 'CLIENT_FAILED'
}

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
  public connectionStatus: SyncConnectionStatus = SyncConnectionStatus.NotConnected;
  public rawOffer: string | null = null;
  public qrData: string | null = null;

  private visibilityListener: (() => void) | null = null;

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

    // Listen for tab visibility changes to refresh/reconnect if needed
    this.visibilityListener = () => {
      if (!document.hidden) {
        this.refreshConnectionState();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  startServerConnection(afterUpdate?: () => void) {
    this.connectionStarted = true;
    this.connectionStatus = SyncConnectionStatus.Server_GeneratingOffer;
    console.log('[SyncService] Starting WebRTC connection as server/initiator');
    
    let iceCandidatesComplete = false;
    
    this.webrtc.createPeerConnection((candidate) => {
      console.log('[SyncService][Server] ICE candidate:', candidate);
      // Generate QR code after getting some ICE candidates
      if (!iceCandidatesComplete) {
        setTimeout(() => {
          const raw = JSON.stringify(this.webrtc.getSignalingData(), null, 2);
          this.rawOffer = raw;
          this.qrData = compressToEncodedURIComponent(raw);
          this.connectionStatus = SyncConnectionStatus.Server_WaitingForAnswer;
          console.log('[SyncService][Server] Updated QR data with ICE candidates:', raw);
          if (afterUpdate) afterUpdate();
        }, 100); // Small delay to allow multiple candidates
      }
    }, true);
    
    this.setupServerDataChannel(afterUpdate);
    this.setupConnectionStateListeners();
    
    this.webrtc.createOffer().then(() => {
      console.log('[SyncService][Server] Offer created, waiting for ICE candidates...');
      // Set a timeout to generate QR code even if no ICE candidates come
      setTimeout(() => {
        if (!this.qrData) {
          const raw = JSON.stringify(this.webrtc.getSignalingData(), null, 2);
          this.rawOffer = raw;
          this.qrData = compressToEncodedURIComponent(raw);
          this.connectionStatus = SyncConnectionStatus.Server_WaitingForAnswer;
          console.log('[SyncService][Server] QR code generated (timeout), QR data:', raw);
          if (afterUpdate) afterUpdate();
        }
        iceCandidatesComplete = true;
      }, 3000); // Wait up to 3 seconds for ICE candidates
    });
  }

  private setupServerDataChannel(afterUpdate?: () => void) {
    this.webrtc.onMessage(msg => {
      let parsed: any;
      try {
        parsed = JSON.parse(msg);
      } catch {}
      if (parsed && parsed.type === 'clientId') {
        console.log('[SyncService][Server] Received peer clientId:', parsed.clientId);
        if (!(parsed.clientId in this.lastSync)) {
          this.lastSync[parsed.clientId] = new Date(0);
          localStorage.setItem(SyncService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
        }
        this.connectionStatus = SyncConnectionStatus.Server_Connected;
      }
      if (afterUpdate) afterUpdate();
    });
    const dataChannel = this.webrtc.createDataChannel();
    this.webrtc.setupDataChannel(dataChannel, () => {
      // Data channel open: send clientId as handshake
      this.webrtc.sendMessage(JSON.stringify({ type: 'clientId', clientId: this.clientId }));
      if (afterUpdate) afterUpdate();
    });
    this.setupConnectionStateListeners();
  }

  /**
   * Process offer data (from QR or pasted) as client.
   * Handles decompression, peer connection, signaling, and answer creation.
   * Returns a promise that resolves to the client answer string (for copying to server), or throws on error.
   */
  async processOfferDataAsClient(data: string, afterUpdate?: () => void): Promise<string> {
    let offerData = data;
    if (data.startsWith('N4Ig') || data.includes('%')) {
      offerData = decompressFromEncodedURIComponent(data) || data;
    }
    const parsed = JSON.parse(offerData);
    this.webrtc.createPeerConnection(() => {}, false);
    await this.webrtc.setSignalingData(parsed);
    this.connectionStatus = SyncConnectionStatus.Client_CreatingAnswer;
    this.setupClientDataChannel(afterUpdate);
    if (parsed.offer) {
      const answer = await this.webrtc.createAnswer(parsed.offer);
      this.connectionStatus = SyncConnectionStatus.Client_AnswerCreated;
      const answerData = {
        answer: answer,
        candidates: this.webrtc.getSignalingData().candidates
      };
      return JSON.stringify(answerData, null, 2);
    }
    throw new Error('No offer found in data');
  }

  /**
   * Process client answer (from input) as server.
   * Handles signaling and connection state.
   * Returns a promise that resolves when done, or throws on error.
   */
  async processClientAnswerAsServer(data: string): Promise<void> {
    const answerData = JSON.parse(data);
    await this.webrtc.setSignalingData(answerData);
    if (this.connectionStatus !== SyncConnectionStatus.Server_Connected) {
    this.connectionStatus = SyncConnectionStatus.Server_AnswerProcessed;
    }
  }

  /**
   * Sets up the data channel and message handler for the client side.
   */
  private setupClientDataChannel(afterUpdate?: () => void) {
    this.webrtc.onMessage(msg => {
      let parsed: any;
      try {
        parsed = JSON.parse(msg);
      } catch {}
      if (parsed && parsed.type === 'clientId') {
        console.log('[SyncService][Client] Received peer clientId:', parsed.clientId);
        if (!(parsed.clientId in this.lastSync)) {
          this.lastSync[parsed.clientId] = new Date(0);
          localStorage.setItem(SyncService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
        }
        this.connectionStatus = SyncConnectionStatus.Client_Connected;
      }
      if (afterUpdate) afterUpdate();
    });
    const dataChannel = this.webrtc.createDataChannel();
    this.webrtc.setupDataChannel(dataChannel, () => {
      // Data channel open for client: send clientId as handshake
      this.webrtc.sendMessage(JSON.stringify({ type: 'clientId', clientId: this.clientId }));
      if (afterUpdate) afterUpdate();
    });

    this.setupConnectionStateListeners();
  }

  /**
   * Listen to WebRTC connection state and update sync status accordingly.
   * If connection is lost, set status to NotConnected or Failed.
   */
  private setupConnectionStateListeners() {
    const checkState = () => {
      const state = this.webrtc.getConnectionState();
      if (state.peerConnectionState === 'disconnected' || state.peerConnectionState === 'failed') {
        this.connectionStatus = SyncConnectionStatus.Server_Failed;
      } else if (state.dataChannelState === 'closed' || !state.hasDataChannel) {
        this.connectionStatus = SyncConnectionStatus.NotConnected;
      }
    };
    // Listen for connection state changes
    const pc = this.webrtc.getPeerConnection();
    if (pc) {
      pc.onconnectionstatechange = checkState;
      pc.oniceconnectionstatechange = checkState;
    }
    // Also check immediately
    checkState();
  }

  private generateClientId(): SyncClientId {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  setLastSync(clientId: SyncClientId, date: Date) {
    this.lastSync[clientId] = date;
    localStorage.setItem(SyncService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
  }

  reset() {
    this.showConnect = false;
    this.connectionStarted = false;
    this.connectionStatus = SyncConnectionStatus.NotConnected;
    this.rawOffer = null;
    this.qrData = null;
    // Optionally clear lastSync, but keep clientId persistent
    // this.lastSync = {};
    // localStorage.removeItem(SyncService.LAST_SYNC_KEY);
    if (this.webrtc && typeof this.webrtc.reset === 'function') {
      this.webrtc.reset();
    } else if (this.webrtc && typeof this.webrtc.close === 'function') {
      this.webrtc.close();
    }
    // Remove visibilitychange listener
    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  /**
   * Called on tab resume/visibilitychange. Refreshes connection state and attempts reconnect if needed.
   */
  public refreshConnectionState() {
    const state = this.webrtc.getConnectionState();
    if (state.peerConnectionState === 'disconnected' || state.peerConnectionState === 'failed') {
      this.connectionStatus = SyncConnectionStatus.Server_Failed;
      // Optionally, could auto-retry here
    } else if (state.dataChannelState === 'closed' || !state.hasDataChannel) {
      this.connectionStatus = SyncConnectionStatus.NotConnected;
    } else if (state.peerConnectionState === 'connected' && state.dataChannelState === 'open') {
      // If everything is good, set to connected if not already
      if (this.connectionStatus !== SyncConnectionStatus.Server_Connected && this.connectionStatus !== SyncConnectionStatus.Client_Connected) {
        this.connectionStatus = SyncConnectionStatus.Server_Connected;
      }
    }
  }
}

import { Injectable } from '@angular/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { ImageService } from './image.service';
import { WebRTCService } from './webrtc.service';

export type SyncDeviceId = string;

export interface ItemServiceInterface {
  itemDeltasSince(time: Date): any[];
  applyRemoteDeltas(deltas: any[]): void;
}

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
  Client_Failed = 'CLIENT_FAILED',
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  static readonly DEVICE_ID_KEY = 'deviceId';
  static readonly LAST_SYNC_KEY = 'lastSync';
  static readonly FAKE_DEVICE_ID = 'FAKE_DEVICE_FOR_DISPLAY';
  static readonly ICE_CANDIDATE_DELAY = 100; // ms
  static readonly ICE_TIMEOUT = 3000; // ms

  /** Reference to ItemService for delta sync. Set by ItemService constructor. */
  public itemService?: ItemServiceInterface;

  // Public state properties
  public deviceId: SyncDeviceId;
  public lastSync: Record<SyncDeviceId, Date> = {};

  // SyncComponent stateful data
  public showConnect = false;
  public connectionStarted = false;
  public connectionStatus: SyncConnectionStatus = SyncConnectionStatus.NotConnected;
  public rawOffer: string | null = null;
  public qrData: string | null = null;

  private visibilityListener: (() => void) | null = null;
  private dataChannel?: RTCDataChannel;
  /**
   * Tracks the current sync role: 'Server' or 'Client'.
   */
  private syncRole: 'Server' | 'Client' | null = null;

  constructor(
    public webrtc: WebRTCService,
    public imageService: ImageService,
  ) {
    const storedDeviceId = localStorage.getItem(SyncService.DEVICE_ID_KEY);
    if (storedDeviceId) {
      this.deviceId = storedDeviceId;
    } else {
      this.deviceId = this.generateDeviceId();
      localStorage.setItem(SyncService.DEVICE_ID_KEY, this.deviceId);
    }
    const storedLastSync = localStorage.getItem(SyncService.LAST_SYNC_KEY);
    if (storedLastSync) {
      try {
        const parsed = JSON.parse(storedLastSync);
        for (const k in parsed) {
          this.lastSync[k] = new Date(parsed[k]);
        }
      } catch (error) {
        console.warn('[SyncService] Failed to parse stored lastSync data:', error);
      }
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
    this.syncRole = 'Server';
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
        }, SyncService.ICE_CANDIDATE_DELAY);
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
      }, SyncService.ICE_TIMEOUT);
    });
  }

  /**
   * Common message handler for both server and client data channels.
   * Handles deviceId handshake, lastSync exchange, item-sync, and image-sync messages.
   */
  private handleWebRTCMessage(msg: string, role: 'Server' | 'Client', afterUpdate?: () => void) {
    let parsed: any;
    try {
      parsed = JSON.parse(msg);
    } catch (error) {
      console.warn(`[SyncService][${role}] Failed to parse WebRTC message:`, error);
      return;
    }
    
    if (parsed && parsed.type === 'deviceId') {
      console.log(`[SyncService][${role}] Received peer deviceId:`, parsed.deviceId);
      if (!(parsed.deviceId in this.lastSync)) {
        this.updateLastSync(parsed.deviceId);
      }
      
      if (role === 'Server') {
        // Send our lastSync for this deviceId
        const lastSyncValue = this.lastSync[parsed.deviceId] instanceof Date ? 
          this.lastSync[parsed.deviceId].toISOString() : this.lastSync[parsed.deviceId];
        this.webrtc.sendMessage(JSON.stringify({ 
          type: 'lastSync', 
          deviceId: this.deviceId, 
          forDevice: parsed.deviceId, 
          lastSync: lastSyncValue 
        }));
        this.connectionStatus = SyncConnectionStatus.Server_Connected;
      } else {
        this.connectionStatus = SyncConnectionStatus.Client_Connected;
      }
    }
    
    if (parsed && parsed.type === 'lastSync') {
      console.log(`[SyncService][${role}] Received lastSync from`, parsed.deviceId, 'for', parsed.forDevice, 'date:', parsed.lastSync);
      // Send item deltas since lastSync to the requesting device
      if (parsed.forDevice === this.deviceId && this.itemService) {
        const since = new Date(parsed.lastSync);
        const deltas = this.itemService.itemDeltasSince(since);
        this.webrtc.sendMessage(JSON.stringify({ type: 'item-sync', deltas, from: this.deviceId, to: parsed.deviceId }));
        
        // Also send image-sync for any photosAdded
        if (Array.isArray(deltas) && deltas.length > 0) {
          const allPhotoIds = deltas.flatMap((d: any) => d.photosAdded || []);
          console.log(`[SyncService][${role}] Sending image-sync for photos:`, allPhotoIds);
          const uniquePhotoIds = Array.from(new Set(allPhotoIds));
          if (uniquePhotoIds.length > 0) {
            const photos = uniquePhotoIds
              .map((uniquePhotoId: string) => {
                const data = this.imageService.getPhotoData(uniquePhotoId);
                return data ? { id: uniquePhotoId, data } : null;
              })
              .filter((p: any) => p !== null);
            const dc = this.dataChannel;
            if (dc && dc.readyState === 'open') {
              this.webrtc.sendMessage(JSON.stringify({ type: 'image-sync', photos, from: this.deviceId, to: parsed.deviceId }));
            } else {
              console.warn('[SyncService] Data channel not open, skipping image-sync send');
            }
          }
        }
      }
    }
    
    if (parsed && parsed.type === 'item-sync') {
      console.log(`[SyncService][${role}] Received item-sync:`, parsed);
      if (this.itemService && Array.isArray(parsed.deltas)) {
        this.itemService.applyRemoteDeltas(parsed.deltas);
      }
    }
    
    if (parsed && parsed.type === 'image-sync' && Array.isArray(parsed.photos)) {
      console.log(`[SyncService][${role}] Received image-sync:`, parsed);
      this.imageService.syncPhoto(parsed.photos);
    }
    
    if (afterUpdate) afterUpdate();
  }

  private setupServerDataChannel(afterUpdate?: () => void) {
    this.webrtc.onMessage(msg => {
      this.handleWebRTCMessage(msg, 'Server', afterUpdate);
    });
    const dataChannel = this.webrtc.createDataChannel();
    this.dataChannel = dataChannel;
    this.webrtc.setupDataChannel(dataChannel, () => {
      // Data channel open: send deviceId as handshake
      this.sendDeviceIdHandshake();
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
    this.syncRole = 'Client';
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
      this.handleWebRTCMessage(msg, 'Client', afterUpdate);
    });
    const dataChannel = this.webrtc.createDataChannel();
    this.dataChannel = dataChannel;
    this.webrtc.setupDataChannel(dataChannel, () => {
      // Data channel open for client: send deviceId as handshake
      this.sendDeviceIdHandshake();
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
        this.connectionStatus = this.syncRole === 'Server'
          ? SyncConnectionStatus.Server_Failed
          : SyncConnectionStatus.Client_Failed;
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

  /**
   * Generate a new device ID.
   */
  private generateDeviceId(): SyncDeviceId {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  /**
   * Helper method to send device ID handshake message.
   */
  private sendDeviceIdHandshake() {
    this.webrtc.sendMessage(JSON.stringify({ type: 'deviceId', deviceId: this.deviceId }));
  }

  /**
   * Helper method to update and persist lastSync data.
   */
  private updateLastSync(deviceId: SyncDeviceId, date: Date = new Date(0)) {
    this.lastSync[deviceId] = date;
    localStorage.setItem(SyncService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
  }

  /**
   * Reset the sync service state.
   */
  public reset() {
    this.showConnect = false;
    this.connectionStarted = false;
    this.connectionStatus = SyncConnectionStatus.NotConnected;
    this.rawOffer = null;
    this.qrData = null;
    localStorage.removeItem(SyncService.DEVICE_ID_KEY);
    localStorage.removeItem(SyncService.LAST_SYNC_KEY);
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

  setLastSync(deviceId: SyncDeviceId, date: Date) {
    this.lastSync[deviceId] = date;
    localStorage.setItem(SyncService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
  }

  /**
   * Called on tab resume/visibilitychange. Refreshes connection state and attempts reconnect if needed.
   */
  public refreshConnectionState() {
    const state = this.webrtc.getConnectionState();
    if (state.peerConnectionState === 'disconnected' || state.peerConnectionState === 'failed') {
      this.connectionStatus = this.syncRole === 'Server'
        ? SyncConnectionStatus.Server_Failed
        : SyncConnectionStatus.Client_Failed;
      // Optionally, could auto-retry here
    } else if (state.dataChannelState === 'closed' || !state.hasDataChannel) {
      this.connectionStatus = SyncConnectionStatus.NotConnected;
    } else if (state.peerConnectionState === 'connected' && state.dataChannelState === 'open') {
      // If everything is good, set to connected if not already
      if (this.connectionStatus !== SyncConnectionStatus.Server_Connected &&
          this.connectionStatus !== SyncConnectionStatus.Client_Connected) {
        this.connectionStatus = this.syncRole === 'Server'
          ? SyncConnectionStatus.Server_Connected
          : SyncConnectionStatus.Client_Connected;
      }
    }
  }
}

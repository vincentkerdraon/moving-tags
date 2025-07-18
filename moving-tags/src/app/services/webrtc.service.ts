import { Injectable } from '@angular/core';

export type SyncDeviceId = string;

/**
 * Minimal WebRTC service for QR-based signaling and auto-reconnect.
 * - Use createPeerConnection, createOffer, createAnswer, setRemoteDescription, addIceCandidate, setupDataChannel.
 * - Use QR code to exchange offer/answer/candidates.
 * - Handles auto-reconnect and message send/receive.
 * - Manages device IDs and sync timestamps
 */
@Injectable({ providedIn: 'root' })
export class WebRTCService {
  static readonly DEVICE_ID_KEY = 'webrtc.deviceId';
  static readonly LAST_SYNC_KEY = 'webrtc.lastSync';

  // Device management
  public deviceId: SyncDeviceId;
  public lastSync: Record<SyncDeviceId, Date> = {};

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onMessageCallback: ((msg: string) => void) | null = null;
  private onDataChannelCallback: ((channel: RTCDataChannel) => void) | null = null;
  private onConnectionStateCallback: ((connected: boolean) => void) | null = null;
  private reconnectTimeout: any = null;
  private reconnectDelay = 2000; // ms
  private healthCheckInterval: any = null;
  private healthCheckDelay = 30000; // 30 seconds
  private lastOffer: RTCSessionDescriptionInit | null = null;
  private lastAnswer: RTCSessionDescriptionInit | null = null;
  private lastCandidates: RTCIceCandidateInit[] = [];
  private isInitiator = false;
  private isConnected = false;
  private shouldMaintainConnection = false; // Whether to auto-reconnect

  constructor() {
    // Initialize device ID
    const storedDeviceId = localStorage.getItem(WebRTCService.DEVICE_ID_KEY);
    if (storedDeviceId) {
      this.deviceId = storedDeviceId;
    } else {
      this.deviceId = this.generateDeviceId();
      localStorage.setItem(WebRTCService.DEVICE_ID_KEY, this.deviceId);
    }

    // Load lastSync data
    const storedLastSync = localStorage.getItem(WebRTCService.LAST_SYNC_KEY);
    if (storedLastSync) {
      try {
        const parsed = JSON.parse(storedLastSync);
        for (const k in parsed) {
          this.lastSync[k] = new Date(parsed[k]);
        }
      } catch (error) {
        console.warn('[WebRTCService] Failed to parse stored lastSync data:', error);
      }
    }
  }

  /**
   * Export the current offer/answer/candidates for QR code transfer.
   */
  getSignalingData() {
    return {
      offer: this.lastOffer,
      answer: this.lastAnswer,
      candidates: this.lastCandidates
    };
  }

  /**
   * Import offer/answer/candidates from QR code and apply to connection.
   */
  async setSignalingData(data: any) {
    console.log('[WebRTCService] Setting signaling data:', data);

    if (data.offer) {
      console.log('[WebRTCService] Processing offer:', data.offer);
      await this.setRemoteDescription(data.offer);
      this.lastOffer = data.offer;
      console.log('[WebRTCService] Offer set successfully');
    }
    if (data.answer) {
      console.log('[WebRTCService] Processing answer:', data.answer);
      await this.setRemoteDescription(data.answer);
      this.lastAnswer = data.answer;
      console.log('[WebRTCService] Answer set successfully');
    }
    if (Array.isArray(data.candidates)) {
      console.log('[WebRTCService] Processing', data.candidates.length, 'ICE candidates');
      for (const c of data.candidates) {
        await this.addIceCandidate(c);
        this.lastCandidates.push(c);
      }
      console.log('[WebRTCService] All ICE candidates processed');
    }
    console.log('[WebRTCService] Signaling data processing complete');
  }

  // --- Auto-reconnect logic ---
  private setupAutoReconnect() {
    if (!this.peerConnection) return;
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection?.connectionState === 'disconnected' || this.peerConnection?.connectionState === 'failed') {
        this.tryReconnect();
      }
    };
  }

  private tryReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(async () => {
      this.close();
      // Re-initiate connection as initiator or responder
      if (this.isInitiator) {
        this.createPeerConnection(() => { });
        this.createDataChannel();
        const offer = await this.createOffer();
        this.lastOffer = offer;
      } else {
        this.createPeerConnection(() => { });
        if (this.lastOffer) await this.setRemoteDescription(this.lastOffer);
        if (this.lastAnswer) await this.setRemoteDescription(this.lastAnswer);
        for (const c of this.lastCandidates) await this.addIceCandidate(c);
      }
      this.reconnectTimeout = null;
    }, this.reconnectDelay);
  }

  // --- Override connection setup to enable auto-reconnect and store signaling ---
  createPeerConnection(onIceCandidate: (candidate: RTCIceCandidate) => void, initiator = false): RTCPeerConnection {
    console.log('[WebRTCService] Creating peer connection, initiator:', initiator);
    this.isInitiator = initiator;
    this.peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTCService] ICE candidate generated:', event.candidate);
        onIceCandidate(event.candidate);
        this.lastCandidates.push(event.candidate.toJSON());
      } else {
        console.log('[WebRTCService] ICE gathering complete');
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('[WebRTCService] Data channel received:', event.channel.label);
      this.dataChannel = event.channel;
      this.setupDataChannel(event.channel);
      // Notify sync service that data channel is available
      if (this.onDataChannelCallback) {
        this.onDataChannelCallback(event.channel);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTCService] Connection state changed:', this.peerConnection?.connectionState);
      this.updateConnectionState();
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTCService] ICE connection state changed:', this.peerConnection?.iceConnectionState);
      this.updateConnectionState();
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTCService] ICE gathering state changed:', this.peerConnection?.iceGatheringState);
    };

    this.setupAutoReconnect();
    return this.peerConnection;
  }

  createDataChannel(label = 'data'): RTCDataChannel {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    console.log('[WebRTCService] Creating data channel:', label);
    this.dataChannel = this.peerConnection.createDataChannel(label);
    this.setupDataChannel(this.dataChannel);
    return this.dataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    console.log('[WebRTCService] Creating offer...');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.lastOffer = offer;
    console.log('[WebRTCService] Offer created and set as local description');
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    console.log('[WebRTCService] Creating answer for offer...');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.lastAnswer = answer;
    console.log('[WebRTCService] Answer created and set as local description');
    return answer;
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    console.log('[WebRTCService] Setting remote description:', desc.type);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    console.log('[WebRTCService] Remote description set successfully');
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    console.log('[WebRTCService] Adding ICE candidate:', candidate);
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('[WebRTCService] ICE candidate added successfully');
  }

  setupDataChannel(channel: RTCDataChannel, onOpenCallback?: () => void) {
    console.log('[WebRTCService] Setting up data channel:', channel.label);
    this.dataChannel = channel;
    channel.onopen = () => {
      console.log('[WebRTCService] Data channel opened:', channel.label);
      this.updateConnectionState();
      if (onOpenCallback) onOpenCallback();
    };
    channel.onclose = () => {
      console.log('[WebRTCService] Data channel closed:', channel.label);
      this.updateConnectionState();
    };
    channel.onerror = (e) => {
      console.error('[WebRTCService] Data channel error:', e);
      this.updateConnectionState();
    };
    channel.onmessage = (event) => {
      console.log('[WebRTCService] Data channel message received:', channel.label, event.data);
      if (this.onMessageCallback) this.onMessageCallback(event.data);
    };
  }

  sendMessage(msg: string) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      console.log('[WebRTCService] Sending message:', msg);
      this.dataChannel.send(msg);
    } else {
      console.warn('[WebRTCService] Cannot send message, data channel not ready. State:', this.dataChannel?.readyState);
    }
  }

  onMessage(cb: (msg: string) => void) {
    this.onMessageCallback = cb;
  }

  onDataChannel(cb: (channel: RTCDataChannel) => void) {
    this.onDataChannelCallback = cb;
  }

  onConnectionState(cb: (connected: boolean) => void) {
    this.onConnectionStateCallback = cb;
  }

  hasDataChannel(): boolean {
    return this.dataChannel !== null;
  }

  isConnectionHealthy(): boolean {
    return this.isConnected &&
      this.peerConnection?.connectionState === 'connected' &&
      this.dataChannel?.readyState === 'open';
  }

  startHealthCheck() {
    console.log('[WebRTCService] Starting health check (every 30s)');
    this.shouldMaintainConnection = true;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.healthCheckInterval = setInterval(() => {
      console.log('[WebRTCService] Health check - connection healthy:', this.isConnectionHealthy());
      if (this.shouldMaintainConnection && !this.isConnectionHealthy()) {
        console.log('[WebRTCService] Connection unhealthy, attempting reconnect');
        this.tryReconnect();
      }
    }, this.healthCheckDelay);
  }

  stopHealthCheck() {
    console.log('[WebRTCService] Stopping health check');
    this.shouldMaintainConnection = false;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  forceReconnect() {
    console.log('[WebRTCService] Force reconnect requested');
    this.tryReconnect();
  }

  private updateConnectionState() {
    const wasConnected = this.isConnected;
    this.isConnected = this.isConnectionHealthy();

    if (wasConnected !== this.isConnected) {
      console.log('[WebRTCService] Connection state changed:', this.isConnected ? 'connected' : 'disconnected');
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(this.isConnected);
      }
    }
  }

  close() {
    this.stopHealthCheck();
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.lastOffer = null;
    this.lastAnswer = null;
    this.lastCandidates = [];
    this.onMessageCallback = null;
    this.onDataChannelCallback = null;
    this.onConnectionStateCallback = null;
    this.reconnectTimeout && clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.isConnected = false;
  }

  reset() {
    this.close();
    // All stateful fields
    this.onMessageCallback = null;
    this.onDataChannelCallback = null;
    this.onConnectionStateCallback = null;
    this.reconnectTimeout && clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.lastOffer = null;
    this.lastAnswer = null;
    this.lastCandidates = [];
    this.isInitiator = false;
    this.isConnected = false;
    this.shouldMaintainConnection = false;
  }

  getConnectionState() {
    return {
      peerConnectionState: this.peerConnection?.connectionState,
      iceConnectionState: this.peerConnection?.iceConnectionState,
      dataChannelState: this.dataChannel?.readyState,
      hasDataChannel: !!this.dataChannel,
      hasPeerConnection: !!this.peerConnection,
      isConnected: this.isConnected
    };
  }

  // Session management methods
  saveSession(sessionData: any) {
    console.log('[WebRTCService] Saving session to localStorage');
    localStorage.setItem('webrtc.session', JSON.stringify(sessionData));
  }

  loadSession(): any | null {
    const saved = localStorage.getItem('webrtc.session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[WebRTCService] Failed to parse saved session:', e);
      }
    }
    return null;
  }

  clearSession() {
    localStorage.removeItem('webrtc.session');
  }

  // High-level connection methods
  startAsServer(onOfferReady?: (offer: string) => void) {
    console.log('[WebRTCService] Starting as server');
    this.isInitiator = true;
    this.startHealthCheck();

    // Create peer connection and data channel
    this.createPeerConnection(() => { }, true);
    this.createDataChannel();

    // Create offer
    this.createOffer().then(() => {
      setTimeout(() => {
        const signaling = this.getSignalingData();
        const offerString = JSON.stringify(signaling, null, 2);

        // Save session
        this.saveSession({
          role: 'server',
          offer: offerString
        });

        if (onOfferReady) {
          onOfferReady(offerString);
        }
      }, 100);
    });
  }

  async connectAsClient(offerData: string, onAnswerReady?: (answer: string) => void) {
    console.log('[WebRTCService] Connecting as client');
    this.isInitiator = false;
    this.startHealthCheck();

    // Parse offer data (should already be JSON)
    const parsed = JSON.parse(offerData);

    // Create peer connection and process offer
    this.createPeerConnection(() => { }, false);
    await this.setSignalingData(parsed);

    if (parsed.offer) {
      const answer = await this.createAnswer(parsed.offer);
      const answerData = {
        answer: answer,
        candidates: this.getSignalingData().candidates
      };
      const answerString = JSON.stringify(answerData, null, 2);

      // Save session
      this.saveSession({
        role: 'client',
        offer: offerData
      });

      if (onAnswerReady) {
        onAnswerReady(answerString);
      }

      return answerString;
    }
    throw new Error('No offer found in data');
  }

  async processAnswer(answerData: string) {
    console.log('[WebRTCService] Processing answer as server');
    // Parse answer data (should already be JSON)
    const parsed = JSON.parse(answerData);
    await this.setSignalingData(parsed);
  }

  // Session restore functionality
  async restoreSession(): Promise<boolean> {
    console.log('[WebRTCService] Attempting to restore session');
    const session = this.loadSession();
    if (!session) {
      console.log('[WebRTCService] No session to restore');
      return false;
    }

    try {
      if (session.role === 'server') {
        console.log('[WebRTCService] Restoring server session');
        // For server, we need to wait for client to reconnect
        // Just start the health check, actual reconnection happens via UI
        this.startHealthCheck();
        return true;
      } else if (session.role === 'client' && session.offer) {
        console.log('[WebRTCService] Restoring client session');
        // For client, attempt to reconnect using stored offer
        await this.connectAsClient(session.offer);
        return true;
      }
    } catch (error) {
      console.error('[WebRTCService] Failed to restore session:', error);
      this.clearSession();
    }

    return false;
  }

  // Initialize WebRTC service - call this on app startup
  async initialize() {
    console.log('[WebRTCService] Initializing...');

    // Start health check monitoring
    this.startHealthCheck();

    // Try to restore previous session
    const restored = await this.restoreSession();
    if (restored) {
      console.log('[WebRTCService] Session restored successfully');
    } else {
      console.log('[WebRTCService] No session to restore or restore failed');
    }
  }
  /**
   * Public getter for peerConnection (for connection state listeners in SyncService)
   */
  public getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  // Device Management Methods

  /**
   * Generate a new device ID.
   */
  private generateDeviceId(): SyncDeviceId {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  /**
   * Get the current device ID.
   */
  public getDeviceId(): SyncDeviceId {
    return this.deviceId;
  }

  /**
   * Update and persist lastSync data.
   */
  public updateLastSync(deviceId: SyncDeviceId, date: Date = new Date(0)) {
    this.lastSync[deviceId] = date;
    localStorage.setItem(WebRTCService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
  }

  /**
   * Set lastSync for a specific device.
   */
  public setLastSync(deviceId: SyncDeviceId, date: Date) {
    this.lastSync[deviceId] = date;
    localStorage.setItem(WebRTCService.LAST_SYNC_KEY, JSON.stringify(this.lastSync));
  }

  /**
   * Get lastSync data.
   */
  public getLastSync(): Record<SyncDeviceId, Date> {
    return this.lastSync;
  }

  /**
   * Send device ID handshake message.
   */
  public sendDeviceIdHandshake() {
    this.sendMessage(JSON.stringify({ type: 'deviceId', deviceId: this.deviceId }));
  }
}

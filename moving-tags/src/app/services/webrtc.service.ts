import { Injectable } from '@angular/core';

/**
 * Minimal WebRTC service for QR-based signaling and auto-reconnect.
 * - Use createPeerConnection, createOffer, createAnswer, setRemoteDescription, addIceCandidate, setupDataChannel.
 * - Use QR code to exchange offer/answer/candidates.
 * - Handles auto-reconnect and message send/receive.
 */
@Injectable({ providedIn: 'root' })
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onMessageCallback: ((msg: string) => void) | null = null;
  private reconnectTimeout: any = null;
  private reconnectDelay = 2000; // ms
  private lastOffer: RTCSessionDescriptionInit | null = null;
  private lastAnswer: RTCSessionDescriptionInit | null = null;
  private lastCandidates: RTCIceCandidateInit[] = [];
  private isInitiator = false;

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
        this.createPeerConnection(() => {});
        this.createDataChannel();
        const offer = await this.createOffer();
        this.lastOffer = offer;
      } else {
        this.createPeerConnection(() => {});
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
      this.setupDataChannel(event.channel);
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTCService] Connection state changed:', this.peerConnection?.connectionState);
    };
    
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTCService] ICE connection state changed:', this.peerConnection?.iceConnectionState);
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
      if (onOpenCallback) onOpenCallback();
    };
    channel.onclose = () => {
      console.log('[WebRTCService] Data channel closed:', channel.label);
    };
    channel.onerror = (e) => {
      console.error('[WebRTCService] Data channel error:', e);
    };
    channel.onmessage = (event) => {
      console.log('[WebRTCService] Data channel message received:', event.data);
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

  close() {
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.lastOffer = null;
    this.lastAnswer = null;
    this.lastCandidates = [];
    this.reconnectTimeout && clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
  }

  getConnectionState() {
    return {
      peerConnectionState: this.peerConnection?.connectionState,
      iceConnectionState: this.peerConnection?.iceConnectionState,
      dataChannelState: this.dataChannel?.readyState,
      hasDataChannel: !!this.dataChannel,
      hasPeerConnection: !!this.peerConnection
    };
  }
}

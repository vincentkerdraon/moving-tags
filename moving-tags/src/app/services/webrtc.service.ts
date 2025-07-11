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
    if (data.offer) {
      await this.setRemoteDescription(data.offer);
      this.lastOffer = data.offer;
    }
    if (data.answer) {
      await this.setRemoteDescription(data.answer);
      this.lastAnswer = data.answer;
    }
    if (Array.isArray(data.candidates)) {
      for (const c of data.candidates) {
        await this.addIceCandidate(c);
        this.lastCandidates.push(c);
      }
    }
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
    this.isInitiator = initiator;
    this.peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
        this.lastCandidates.push(event.candidate.toJSON());
      }
    };
    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
    this.setupAutoReconnect();
    return this.peerConnection;
  }

  createDataChannel(label = 'data'): RTCDataChannel {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    this.dataChannel = this.peerConnection.createDataChannel(label);
    this.setupDataChannel(this.dataChannel);
    return this.dataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.lastOffer = offer;
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.lastAnswer = answer;
    return answer;
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not created');
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.onopen = () => console.log('Data channel open');
    channel.onclose = () => console.log('Data channel closed');
    channel.onerror = (e) => console.error('Data channel error', e);
    channel.onmessage = (event) => {
      if (this.onMessageCallback) this.onMessageCallback(event.data);
    };
  }

  sendMessage(msg: string) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(msg);
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
}

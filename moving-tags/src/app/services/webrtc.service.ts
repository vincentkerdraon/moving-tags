import { Injectable } from '@angular/core';
import { DeviceId } from '../models/data.models';

// WebRTCService doesn't allow reconnection with old offer/answer
// It requires a new signaling process for each connection

@Injectable({ providedIn: 'root' })
export class WebRTCService {
    static readonly DEVICE_ID_KEY = 'webrtc.deviceId';

    private _deviceId: DeviceId;
    private peerConnection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private onMessageCallback: ((msg: string) => void) | null = null;
    private onConnectionStateCallback: ((state: RTCPeerConnectionState) => void) | null = null;

    constructor() {
        const storedDeviceId = localStorage.getItem(WebRTCService.DEVICE_ID_KEY);
        if (storedDeviceId) {
            this._deviceId = storedDeviceId;
        } else {
            this._deviceId = this.generateDeviceId();
            localStorage.setItem(WebRTCService.DEVICE_ID_KEY, this._deviceId);
        }
    }

    initialize(): void {
        console.log('[WebRTCService] Initializing...');

        const peerConnection = new RTCPeerConnection();
        const dataChannel = peerConnection.createDataChannel('ch');

        dataChannel.onopen = () => {
            console.log('[WebRTCService] Data channel opened');
            // Send deviceId when data channel opens
            if (this._deviceId) {
                console.log('[WebRTCService] Sending deviceId on data channel open:', this._deviceId);
                dataChannel.send(JSON.stringify({ type: 'deviceId', deviceId: this._deviceId }));
            }
        };

        dataChannel.onmessage = (event) => {
            console.log('[WebRTCService] Message received:', event.data);
            this.onMessageCallback?.(event.data);
        };

        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            console.log('[WebRTCService] Connection state changed:', state);
            this.onConnectionStateCallback?.(state);
        };

        this.peerConnection = peerConnection;
        this.dataChannel = dataChannel;
    }

    startAsServer(onOfferReady?: (offer: string) => void): Promise<void> {
        console.log('[WebRTCService] Starting as server');

        return new Promise((resolve, reject) => {
            this.peerConnection = new RTCPeerConnection();
            // Always create a data channel to ensure m= line in SDP
            this.dataChannel = this.peerConnection.createDataChannel('ch');
            this.dataChannel.onopen = () => {
                console.log('[WebRTCService] Data channel opened (server)');
                // Send deviceId when data channel opens (server)
                if (this._deviceId) {
                    console.log('[WebRTCService] [Server] Sending deviceId on data channel open:', this._deviceId);
                    this.dataChannel!.send(JSON.stringify({ type: 'deviceId', deviceId: this._deviceId }));
                }
            };
            this.dataChannel.onmessage = (event) => {
                console.log('[WebRTCService] Message received (server):', event.data);
                this.onMessageCallback?.(event.data);
            };
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('[WebRTCService][Server] ICE candidate');
                }
            };
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection!.connectionState;
                console.log('[WebRTCService] Server connection state changed:', state);
                this.onConnectionStateCallback?.(state);
            };

            this.peerConnection.createOffer().then((offer) => {
                this.peerConnection!.setLocalDescription(offer);
                // Wait for ICE gathering to complete
                const pc = this.peerConnection!;
                const waitForIce = new Promise<void>((iceResolve) => {
                    if (pc.iceGatheringState === 'complete') {
                        iceResolve();
                    } else {
                        const checkState = () => {
                            if (pc.iceGatheringState === 'complete') {
                                pc.removeEventListener('icegatheringstatechange', checkState);
                                iceResolve();
                            }
                        };
                        pc.addEventListener('icegatheringstatechange', checkState);
                    }
                });
                waitForIce.then(() => {
                    let sdp = pc.localDescription?.sdp || '';
                    // Remove a=ice-options:trickle and a=max-message-size
                    const lines = sdp.split('\r\n');
                    const filteredLines = lines.filter(line => {
                        const trimmed = line.trim();
                        return !trimmed.startsWith('a=max-message-size') && !trimmed.startsWith('a=ice-options:trickle');
                    });
                    sdp = filteredLines.join('\r\n');
                    if (onOfferReady) {
                        onOfferReady(sdp);
                    }
                    resolve();
                });
            }).catch((error) => {
                console.error('[WebRTCService] Failed to create offer:', error);
                reject(error);
            });
        });
    }

    connectAsClient(offerData: string, onAnswerReady?: (answer: string) => void): Promise<void> {
        console.log('[WebRTCService] Connecting as client with offer:', { offerData });
        return new Promise((resolve, reject) => {
            this.peerConnection = new RTCPeerConnection();
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('[WebRTCService][Client] ICE candidate');
                }
            };
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection!.connectionState;
                console.log('[WebRTCService] Client connection state changed:', state);
                this.onConnectionStateCallback?.(state);
            };

            // Set up ondatachannel handler to receive data channel from server
            this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
                this.dataChannel = event.channel;
                this.dataChannel.onopen = () => {
                    console.log('[WebRTCService] Data channel opened (client)');
                    if (this._deviceId) {
                        console.log('[WebRTCService] [Client] Sending deviceId on data channel open:', this._deviceId);
                        this.dataChannel!.send(JSON.stringify({ type: 'deviceId', deviceId: this._deviceId }));
                    }
                };
                this.dataChannel.onmessage = (event: MessageEvent) => {
                    console.log('[WebRTCService] Message received (client):', event.data);
                    this.onMessageCallback?.(event.data);
                };
            };

            const offer = new RTCSessionDescription({ type: 'offer', sdp: offerData });
            this.peerConnection.setRemoteDescription(offer).then(() => {
                return this.peerConnection!.createAnswer();
            }).then((answer) => {
                this.peerConnection!.setLocalDescription(answer);
                // Wait for ICE gathering to complete
                const pc = this.peerConnection!;
                const waitForIce = new Promise<void>((iceResolve) => {
                    if (pc.iceGatheringState === 'complete') {
                        iceResolve();
                    } else {
                        const checkState = () => {
                            if (pc.iceGatheringState === 'complete') {
                                pc.removeEventListener('icegatheringstatechange', checkState);
                                iceResolve();
                            }
                        };
                        pc.addEventListener('icegatheringstatechange', checkState);
                    }
                });
                waitForIce.then(() => {
                    let sdp = pc.localDescription?.sdp || '';
                    // Remove a=ice-options:trickle and a=max-message-size
                    const lines = sdp.split('\r\n');
                    const filteredLines = lines.filter(line => {
                        const trimmed = line.trim();
                        return !trimmed.startsWith('a=max-message-size') && !trimmed.startsWith('a=ice-options:trickle');
                    });
                    sdp = filteredLines.join('\r\n');
                    if (onAnswerReady && sdp) {
                        onAnswerReady(sdp);
                    }
                    resolve();
                });
            }).catch((error) => {
                console.error('[WebRTCService] Failed to connect as client:', error);
                reject(error);
            });
        });
    }

    tryReconnect(): void {
        console.log('[WebRTCService] Attempting ICE restart for connection recovery');

        if (this.peerConnection &&
            (this.peerConnection.connectionState === 'disconnected' ||
                this.peerConnection.connectionState === 'failed')) {

            // Add ICE restart event listener
            this.peerConnection.addEventListener("iceconnectionstatechange", (event) => {
                const pc = this.peerConnection!;
                console.log('[WebRTCService] ICE connection state:', pc.iceConnectionState);

                if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
                    console.log('[WebRTCService] ICE restart triggered due to connection failure');
                    pc.restartIce();
                }
            });

            // Trigger ICE restart immediately if connection is failed
            this.peerConnection.restartIce();
        } else {
            console.log('[WebRTCService] No valid connection to restart, creating new connection');
            this.close();
            this.initialize();
        }
    }

    close(): void {
        console.log('[WebRTCService] Closing connection');
        this.dataChannel?.close();
        this.peerConnection?.close();
        this.dataChannel = null;
        this.peerConnection = null;
    }

    reset(): void {
        console.log('[WebRTCService] Resetting service state');

        this.close();
        this.peerConnection = null;
        this.dataChannel = null;
        this.onMessageCallback = null;
        this.onConnectionStateCallback = null;

        console.log('[WebRTCService] Service state reset complete');
    }

    sendMessage(msg: string): void {
        if (this.dataChannel?.readyState === 'open') {
            console.log('[WebRTCService] Sending message:', msg);
            this.dataChannel.send(msg);
        } else {
            console.warn('[WebRTCService] Data channel is not open');
        }
    }

    onMessage(cb: (msg: string) => void): void {
        console.log('[WebRTCService] Message callback set');
        this.onMessageCallback = cb;
    }

    onConnectionState(cb: (state: RTCPeerConnectionState) => void): void {
        console.log('[WebRTCService] Connection state callback set');
        this.onConnectionStateCallback = cb;
    }

    isConnectionHealthy(): boolean {
        console.log('[WebRTCService] Checking connection health');
        // Only return true if peerConnection exists and is connected
        if (this.peerConnection && this.peerConnection.connectionState === 'connected') {
            return true;
        }
        return false;
    }

    get deviceId(): DeviceId {
        return this._deviceId;
    }

    public processAnswer(answerData: string): Promise<void> {
        console.log('[WebRTCService] Processing answer:', answerData);

        return new Promise((resolve, reject) => {
            if (!this.peerConnection) {
                const error = new Error('[WebRTCService] Peer connection is not initialized');
                console.error(error.message);
                reject(error);
                return;
            }

            const state = this.peerConnection.signalingState;
            console.log('[WebRTCService] Current signaling state before setting remote answer:', state);
            if (state === 'have-local-offer') {
                const answer = new RTCSessionDescription({ type: 'answer', sdp: answerData });
                this.peerConnection.setRemoteDescription(answer).then(() => {
                    console.log('[WebRTCService] Remote description set successfully');
                    // Debug logs after processing answer
                    console.log('[WebRTCService] [DEBUG] PeerConnection state:', this.peerConnection!.connectionState);
                    if (this.dataChannel) {
                        console.log('[WebRTCService] [DEBUG] DataChannel state:', this.dataChannel.readyState);
                    } else {
                        console.log('[WebRTCService] [DEBUG] No data channel present after processing answer');
                    }
                    resolve();
                }).catch((error) => {
                    console.error('[WebRTCService] Failed to set remote description:', error);
                    reject(error);
                });
            } else if (state === 'stable') {
                console.warn('[WebRTCService] Skipping setRemoteDescription(answer): already in stable state.');
                // Debug logs after skipping
                console.log('[WebRTCService] [DEBUG] PeerConnection state:', this.peerConnection!.connectionState);
                if (this.dataChannel) {
                    console.log('[WebRTCService] [DEBUG] DataChannel state:', this.dataChannel.readyState);
                } else {
                    console.log('[WebRTCService] [DEBUG] No data channel present after skipping answer');
                }
                resolve();
            } else {
                const error = new Error(`[WebRTCService] Cannot set remote answer in signaling state: ${state}`);
                console.error(error.message);
                reject(error);
            }
        });
    }

    private generateDeviceId(): string {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
}

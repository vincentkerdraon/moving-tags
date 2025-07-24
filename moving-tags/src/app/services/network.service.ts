import { EventEmitter, Injectable } from '@angular/core';
import { DeviceId } from '../models/data.models';
import { DeviceIdMessage } from '../models/network.models';
import { WebRTCService } from './webrtc.service';


@Injectable({ providedIn: 'root' })
export class NetworkService {
    /**
     * Closes the underlying WebRTC connection and updates connection status.
     */
    close(): void {
        this.webrtcService.close();
        this._connectionStatus = 'not connected';
        this.connectionStatusChanged.emit(this._connectionStatus);
    }
    private _connectionStatus: 'not connected' | 'connecting' | 'connected' = 'not connected';
    private _otherDeviceId?: DeviceId = undefined;
    public connectionStatusChanged = new EventEmitter<'not connected' | 'connecting' | 'connected'>();


    constructor(private webrtcService: WebRTCService) {
        this.webrtcService.onConnectionState((state) => {
            this._connectionStatus = state === 'connected' ? 'connected' : 'not connected';
            console.log(`[NetworkService] Connection status updated: ${this._connectionStatus}`);
            this.connectionStatusChanged.emit(this._connectionStatus);

            // Handle ICE restart for temporary disconnections
            if (state === 'disconnected' || state === 'failed') {
                console.log('[NetworkService] Connection lost, attempting ICE restart...');
                this.attemptIceRestart();
            }
        });
    }

    get otherDeviceId(): DeviceId | undefined {
        return this._otherDeviceId;
    }



    // Removed reconnect logic: WebRTC requires new signaling for each connection

    connectAsClient(offerData: string, onAnswerReady?: (answer: string) => void): Promise<void> {
        console.log('[NetworkService] Received offer and set client mode');
        return this.webrtcService.connectAsClient(offerData, onAnswerReady);
    }


    processAnswer(answerData: string): Promise<void> {
        console.log('[NetworkService] Received answer and set server mode');
        return this.webrtcService.processAnswer(answerData);
    }


    get deviceId(): DeviceId {
        return this.webrtcService.deviceId;
    }

    get connectionStatus(): 'not connected' | 'connecting' | 'connected' {
        return this._connectionStatus;
    }

    sendMessage(msg: string): void {
        this.webrtcService.sendMessage(msg);
    }

    onMessage(cb: (msg: string) => void): void {
        this.webrtcService.onMessage(cb);
    }

    reset(): void {
        this.webrtcService.reset();
    }


    public handleDeviceIdMessage(parsed: DeviceIdMessage): void {
        this._otherDeviceId = parsed.deviceId;
    }

    /**
     * Attempts ICE restart for temporary network disconnections.
     * Note: This only works for brief interruptions, not long-term disconnections.
     * For complete reconnection after extended downtime, manual QR code exchange is required.
     */
    private attemptIceRestart(): void {
        try {
            // Only attempt ICE restart if we have a valid connection to restart
            if (this.webrtcService.isConnectionHealthy() === false && this._connectionStatus !== 'connecting') {
                console.log('[NetworkService] Attempting ICE restart for connection recovery...');
                this.webrtcService.tryReconnect();
            }
        } catch (error) {
            console.warn('[NetworkService] ICE restart failed:', error);
            // ICE restart failed, connection likely needs manual re-establishment
        }
    }
}

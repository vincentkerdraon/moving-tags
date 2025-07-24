import { EventEmitter, Injectable } from '@angular/core';
import { DeviceId } from '../models/data.models';
import { DeviceIdMessage } from '../models/network.models';
import { WebRTCService } from './webrtc.service';

const LOCAL_STORAGE_KEYS = {
    LAST_OFFER: 'webrtc.lastOffer',
    LAST_ANSWER: 'webrtc.lastAnswer',
    IS_SERVER: 'webrtc.isServer'
};

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
    private _couldReconnect = false;
    public connectionStatusChanged = new EventEmitter<'not connected' | 'connecting' | 'connected'>();


    constructor(private webrtcService: WebRTCService) {
        this._couldReconnect = localStorage.getItem(LOCAL_STORAGE_KEYS.IS_SERVER) != null
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

    get couldReconnect(): boolean {
        return this._couldReconnect;
    }

    async reconnect(): Promise<void> {
        // Note: This method attempts to reuse stored signaling data for reconnection.
        // This will NOT work for most disconnection scenarios because WebRTC requires
        // fresh offer/answer exchange. For reliable reconnection after network loss,
        // a new QR code exchange is required.
        
        try {
            const isServer: boolean = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.IS_SERVER) || 'false');
            if (isServer) {
                let answer = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_ANSWER)
                if (answer === null) {
                    throw new Error('[NetworkService] No previous answer found for server connection');
                }
                answer = JSON.parse(answer) || null;
                if (answer === null) {
                    throw new Error('[NetworkService] previous answer not JSON');
                }
                console.log('[NetworkService] reconnect as server');
                this._connectionStatus = 'connecting';

                //FIXMe clean error handling
                await this.webrtcService.startAsServer()
                return this.webrtcService.processAnswer(answer)
            } else {
                console.log('[NetworkService] reconnect as client');
                this._connectionStatus = 'connecting';
                let lastOffer = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_OFFER);
                if (!lastOffer) {
                    throw new Error('[NetworkService] No previous offer found for client connection');
                }
                lastOffer = JSON.parse(lastOffer) || null;
                if (!lastOffer) {
                    throw new Error('[NetworkService] previous offer not JSON');
                }

                //FIXMe clean error handling
                return this.webrtcService.connectAsClient(lastOffer);
            }
        } catch (error) {
            console.error('[NetworkService] Error during reconnect:', error);
            throw error;
        }
    }

    connectAsClient(offerData: string, onAnswerReady?: (answer: string) => void): Promise<void> {
        localStorage.setItem(LOCAL_STORAGE_KEYS.IS_SERVER, JSON.stringify(false));
        localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_OFFER, JSON.stringify(offerData));
        this._couldReconnect = true
        console.log('[NetworkService] Received offer and set client mode');
        return this.webrtcService.connectAsClient(offerData, onAnswerReady);
    }


    processAnswer(answerData: string): Promise<void> {
        localStorage.setItem(LOCAL_STORAGE_KEYS.IS_SERVER, JSON.stringify(true));
        localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_ANSWER, JSON.stringify(answerData));
        this._couldReconnect = true
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
        localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_OFFER);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_ANSWER);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.IS_SERVER);
        this._couldReconnect = false
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

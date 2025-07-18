import { EventEmitter, Injectable } from '@angular/core';
import { DeviceId } from '../models/data.models';
import { WebRTCService } from './webrtc.service';

const LOCAL_STORAGE_KEYS = {
    LAST_OFFER: 'webrtc.lastOffer',
    LAST_ANSWER: 'webrtc.lastAnswer',
    IS_SERVER: 'webrtc.isServer'
};

@Injectable({ providedIn: 'root' })
export class NetworkService {
    private _connectionStatus: 'not connected' | 'connecting' | 'connected' = 'not connected';
    public connectionStatusChanged = new EventEmitter<'not connected' | 'connecting' | 'connected'>();
    public signalingDataReceived = new EventEmitter<any>();

    constructor(private webrtcService: WebRTCService) {
        this.webrtcService.onConnectionState((state) => {
            this._connectionStatus = state === 'connected' ? 'connected' : 'not connected';
            console.log(`[NetworkService] Connection status updated: ${this._connectionStatus}`);
            this.connectionStatusChanged.emit(this._connectionStatus);
        });
    }

    connect(): Promise<void> {
        try {
            const isServer: boolean = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.IS_SERVER) || 'false');
            if (isServer) {
                console.log('[NetworkService] Acting as server');
                return this.webrtcService.startAsServer((offer) => {
                    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_OFFER, JSON.stringify(offer));
                    // deviceId will be sent on data channel open
                });
            } else {
                console.log('[NetworkService] Acting as client');
                const lastOffer = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_OFFER);
                if (!lastOffer) {
                    throw new Error('[NetworkService] No previous offer found for client connection');
                }

                return this.webrtcService.connectAsClient(lastOffer, (answer) => {
                    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_ANSWER, JSON.stringify(answer));
                    console.log('[NetworkService] Client connection answer received:', answer);
                    // deviceId will be sent on data channel open
                });
            }
        } catch (error) {
            console.error('[NetworkService] Error during connection:', error);
            throw error;
        }
    }

    reconnect(): Promise<void> {
        try {
            const lastAnswer = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_ANSWER);
            if (!lastAnswer) {
                throw new Error('[NetworkService] No previous answer found for reconnect');
            }

            return this.webrtcService.processAnswer(lastAnswer);
        } catch (error) {
            console.error('[NetworkService] Error during reconnect:', error);
            throw error;
        }
    }

    receiveSignalingData(data: any): void {
        try {
            if (data.offer) {
                localStorage.setItem(LOCAL_STORAGE_KEYS.IS_SERVER, JSON.stringify(false));
                localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_OFFER, JSON.stringify(data.offer));
                console.log('[NetworkService] Received offer and set client mode');
            }

            if (data.answer) {
                localStorage.setItem(LOCAL_STORAGE_KEYS.IS_SERVER, JSON.stringify(true));
                localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_ANSWER, JSON.stringify(data.answer));
                console.log('[NetworkService] Received answer and set server mode');
            }

            this.signalingDataReceived.emit(data);
        } catch (error) {
            console.error('[NetworkService] Error processing signaling data:', error);
        }
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
    }
}

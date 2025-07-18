import { Injectable } from '@angular/core';
import { ImageService } from './image.service';
import { SyncDeviceId, WebRTCService } from './webrtc.service';

export interface ItemServiceInterface {
  itemDeltasSince(time: Date): any[];
  applyRemoteDeltas(deltas: any[]): void;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  static readonly FAKE_DEVICE_ID = 'FAKE_DEVICE_FOR_DISPLAY';

  /** Reference to ItemService for delta sync. Set by ItemService constructor. */
  public itemService?: ItemServiceInterface;

  private visibilityListener: (() => void) | null = null;

  constructor(
    public webrtc: WebRTCService,
    public imageService: ImageService,
  ) {
    // Listen for tab visibility changes to refresh/reconnect if needed
    this.visibilityListener = () => {
      if (!document.hidden) {
        this.refreshConnectionState();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  /**
   * Triggers a sync: sends item deltas and images to the peer if connected.
   */
  public triggerSync() {
    if (!this.itemService) return;
    if (!this.webrtc.isConnectionHealthy()) {
      console.log('[SyncService] Cannot sync - no healthy WebRTC connection');
      return;
    }

    const deviceId = this.webrtc.getDeviceId();
    const lastSync = this.webrtc.getLastSync();

    // Find the peer deviceId (the one that's not us)
    const peerIds = Object.keys(lastSync).filter(id => id !== deviceId);
    if (peerIds.length === 0) return;

    // For each peer, send only deltas since lastSync and not sent by this peer
    peerIds.forEach(peerId => {
      const since = lastSync[peerId] || new Date(0);
      const deltas = this.itemService!.itemDeltasSince(since).filter(d => d.client != peerId);
      if (deltas.length === 0) return;

      this.webrtc.sendMessage(
        JSON.stringify({ type: 'item-sync', deltas, from: deviceId, to: peerId })
      );

      // Send one image-sync per photo
      const allPhotoIds = deltas.flatMap((d: any) => Array.isArray(d.photosAdded) ? d.photosAdded : []);
      const uniquePhotoIds = Array.from(new Set(allPhotoIds));
      if (uniquePhotoIds.length > 0) {
        uniquePhotoIds.forEach((uniquePhotoId: string, idx: number) => {
          setTimeout(() => {
            const data = this.imageService.getPhotoData(uniquePhotoId);
            if (!data) return;

            if (this.webrtc.isConnectionHealthy()) {
              this.webrtc.sendMessage(
                JSON.stringify({
                  type: 'image-sync',
                  photos: [{ id: uniquePhotoId, data }],
                  from: deviceId,
                  to: peerId,
                })
              );
            }
          }, 2000 + idx * 500);
        });
      }
    });
  }

  /**
   * Initialize sync service - sets up message handling with WebRTC
   */
  public initialize() {
    // Set up message handling with WebRTC service
    this.webrtc.onMessage(msg => {
      this.handleWebRTCMessage(msg);
    });

    // Listen for WebRTC connection state changes
    this.webrtc.onConnectionState((connected) => {
      console.log('[SyncService] WebRTC connection state changed:', connected);
      if (connected) {
        // Send device ID handshake when connected
        this.sendDeviceIdHandshake();
      }
    });
  }

  /**
   * Common message handler for WebRTC data channels.
   * Handles deviceId handshake, lastSync exchange, item-sync, and image-sync messages.
   */
  private handleWebRTCMessage(msg: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(msg);
    } catch (error) {
      console.warn('[SyncService] Failed to parse WebRTC message:', error);
      return;
    }

    const deviceId = this.webrtc.getDeviceId();
    const lastSync = this.webrtc.getLastSync();

    if (parsed && parsed.type === 'deviceId') {
      console.log('[SyncService] Received peer deviceId:', parsed.deviceId);
      if (!(parsed.deviceId in lastSync)) {
        this.webrtc.updateLastSync(parsed.deviceId);
      }
      // Send lastSync for the peer deviceId after handshake
      const lastSyncValue = lastSync[parsed.deviceId] instanceof Date ?
        lastSync[parsed.deviceId].toISOString() : lastSync[parsed.deviceId];
      this.webrtc.sendMessage(JSON.stringify({
        type: 'lastSync',
        deviceId: deviceId,
        forDevice: parsed.deviceId,
        lastSync: lastSyncValue
      }));
    }

    if (parsed && parsed.type === 'lastSync') {
      console.log('[SyncService] Received lastSync from', parsed.deviceId, 'for', parsed.forDevice, 'date:', parsed.lastSync);
      // Send item deltas since lastSync to the requesting device
      if (parsed.forDevice === deviceId && this.itemService) {
        console.log('[SyncService] Sending item-sync');
        const since = new Date(parsed.lastSync);
        const deltas = this.itemService.itemDeltasSince(since);
        this.webrtc.sendMessage(JSON.stringify({ type: 'item-sync', deltas, from: deviceId, to: parsed.deviceId }));

        // Send images for the deltas
        if (Array.isArray(deltas) && deltas.length > 0) {
          const allPhotoIds = deltas.flatMap((d: any) => d.photosAdded || []);
          console.log('[SyncService] Scheduling image-sync for photos:', allPhotoIds);
          const uniquePhotoIds = Array.from(new Set(allPhotoIds));
          if (uniquePhotoIds.length > 0) {
            uniquePhotoIds.forEach((uniquePhotoId: string, idx: number) => {
              setTimeout(() => {
                const data = this.imageService.getPhotoData(uniquePhotoId);
                if (!data) return;

                if (this.webrtc.isConnectionHealthy()) {
                  this.webrtc.sendMessage(JSON.stringify({
                    type: 'image-sync',
                    photos: [{ id: uniquePhotoId, data }],
                    from: deviceId,
                    to: parsed.deviceId
                  }));
                  console.log('[SyncService] image-sync sent for photo', uniquePhotoId);
                } else {
                  console.warn('[SyncService] Connection not healthy, skipping image-sync for', uniquePhotoId);
                }
              }, 2000 + idx * 500); // 2s initial delay, then 0.5s between each
            });
          }
        }
      }
    }

    if (parsed && parsed.type === 'item-sync') {
      console.log('[SyncService] Received item-sync:', parsed);
      if (this.itemService && Array.isArray(parsed.deltas)) {
        this.itemService.applyRemoteDeltas(parsed.deltas);
      }
    }

    if (parsed && parsed.type === 'image-sync' && Array.isArray(parsed.photos)) {
      console.log('[SyncService] Received image-sync:', parsed);
      this.imageService.syncPhoto(parsed.photos);
    }
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
    this.webrtc.sendDeviceIdHandshake();
  }

  /**
   * Helper method to update and persist lastSync data.
   */
  private updateLastSync(deviceId: SyncDeviceId, date: Date = new Date(0)) {
    this.webrtc.updateLastSync(deviceId, date);
  }

  /**
   * Reset the sync service state.
   */
  public reset() {
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
    this.webrtc.setLastSync(deviceId, date);
  }

  /**
   * Called on tab resume/visibilitychange. Refreshes connection state.
   */
  public refreshConnectionState() {
    // Connection state is now managed by WebRTC service
    // This method can be used to trigger any sync-specific refresh logic
    console.log('[SyncService] Refreshing connection state via WebRTC service');
  }
}

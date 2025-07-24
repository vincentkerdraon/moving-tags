import { Injectable } from '@angular/core';
import { DeviceId } from '../models/data.models';
import { DeviceIdMessage, ImageSyncMessage, ItemSyncMessage, LastSyncMessage, NetworkMessage } from '../models/network.models';
import { ImageService } from './image.service';
import { NetworkService } from './network.service';

export interface ItemServiceInterface {
  itemDeltasSince(time: Date): any[];
  applyRemoteDeltas(deltas: any[]): void;
}

const MESSAGE_TYPES = {
  DEVICE_ID: 'deviceId',
  LAST_SYNC: 'lastSync',
  ITEM_SYNC: 'item-sync',
  IMAGE_SYNC: 'image-sync'
};

@Injectable({ providedIn: 'root' })
export class SyncService {
  static readonly FAKE_DEVICE_ID = 'FAKE_DEVICE_FOR_DISPLAY';

  /** Reference to ItemService for delta sync. Set by ItemService constructor. */
  public itemService?: ItemServiceInterface;
  public lastSync: Record<DeviceId, Date> = {};

  constructor(
    public network: NetworkService,
    public imageService: ImageService,
  ) {
    this.network.onMessage(msg => {
      this.handleNetworkMessage(msg);
    });

    this.network.connectionStatusChanged.subscribe((status) => {
      console.log('[SyncService] Network connection state changed:', status);
    });
  }

  /**
   * Triggers a sync: sends item deltas and images to the peer if connected.
   */
  public triggerSync() {
    if (!this.itemService) return;
    if (this.network.connectionStatus !== 'connected') {
      console.log('[SyncService] Cannot sync - no healthy network connection');
      return;
    }

    const deviceId = this.network.deviceId;
    const lastSync = this.lastSync;

    // Find the peer deviceId (the one that's not us)
    const peerIds = Object.keys(lastSync).filter(id => id !== deviceId);
    if (peerIds.length === 0) return;

    // For each peer, send only deltas since lastSync and not sent by this peer
    peerIds.forEach(peerId => {
      const since = lastSync[peerId] || new Date(0);
      const deltas = this.itemService!.itemDeltasSince(since).filter(d => d.client != peerId);
      if (deltas.length === 0) return;

      this.network.sendMessage(
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

            if (this.network.connectionStatus === 'connected') {
              this.network.sendMessage(
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
  public initialize(): void {
    this.network.onMessage(msg => {
      this.handleNetworkMessage(msg);
    });
  }

  private handleDeviceIdMessage(parsed: DeviceIdMessage): void {
    console.log('[SyncService] Received peer deviceId:', parsed.deviceId);

    this.network.handleDeviceIdMessage(parsed);
    const deviceId = this.network.deviceId;
    const lastSync = this.lastSync;

    if (!(parsed.deviceId in lastSync)) {
      this.setLastSync(parsed.deviceId, new Date());
    }

    const lastSyncValue = lastSync[parsed.deviceId] instanceof Date
      ? lastSync[parsed.deviceId].toISOString()
      : lastSync[parsed.deviceId];

    this.network.sendMessage(JSON.stringify({
      type: 'lastSync',
      deviceId: deviceId,
      forDevice: parsed.deviceId,
      lastSync: lastSyncValue,
    }));
  }

  private handleLastSyncMessage(parsed: LastSyncMessage): void {
    const deviceId = this.network.deviceId;
    const lastSync = this.lastSync;

    console.log('[SyncService] Received lastSync from', parsed.deviceId, 'for', parsed.forDevice, 'date:', parsed.lastSync);
    if (parsed.forDevice === deviceId && this.itemService) {
      const since = new Date(parsed.lastSync);
      const deltas = this.itemService.itemDeltasSince(since);

      this.network.sendMessage(JSON.stringify({
        type: 'item-sync',
        deltas,
        from: deviceId,
        to: parsed.deviceId,
      }));

      const allPhotoIds = deltas.flatMap((d: any) => d.photosAdded || []);
      const uniquePhotoIds = Array.from(new Set(allPhotoIds));

      uniquePhotoIds.forEach((uniquePhotoId: string, idx: number) => {
        setTimeout(() => {
          const data = this.imageService.getPhotoData(uniquePhotoId);
          if (!data) return;

          if (this.network.connectionStatus === 'connected') {
            this.network.sendMessage(JSON.stringify({
              type: 'image-sync',
              photos: [{ id: uniquePhotoId, data }],
              from: deviceId,
              to: parsed.deviceId,
            }));
          }
        }, 2000 + idx * 500);
      });
    }
  }

  private handleItemSyncMessage(parsed: ItemSyncMessage): void {
    console.log('[SyncService] Received item-sync:', parsed);
    if (this.itemService && Array.isArray(parsed.deltas)) {
      this.itemService.applyRemoteDeltas(parsed.deltas);
    }
  }

  private handleImageSyncMessage(parsed: ImageSyncMessage): void {
    console.log('[SyncService] Received image-sync:', parsed);
    this.imageService.syncPhoto(parsed.photos);
  }

  /**
   * Common message handler for WebRTC data channels.
   * Handles deviceId handshake, lastSync exchange, item-sync, and image-sync messages.
   */
  private handleNetworkMessage(msg: string): void {
    let parsed: NetworkMessage;
    try {
      parsed = JSON.parse(msg) as NetworkMessage;
    } catch (error) {
      console.warn('[SyncService] Failed to parse network message:', error);
      return;
    }

    switch (parsed.type) {
      case MESSAGE_TYPES.DEVICE_ID:
        this.handleDeviceIdMessage(parsed as DeviceIdMessage);
        break;
      case MESSAGE_TYPES.LAST_SYNC:
        this.handleLastSyncMessage(parsed as LastSyncMessage);
        break;
      case MESSAGE_TYPES.ITEM_SYNC:
        this.handleItemSyncMessage(parsed as ItemSyncMessage);
        break;
      case MESSAGE_TYPES.IMAGE_SYNC:
        this.handleImageSyncMessage(parsed as ImageSyncMessage);
        break;
      default:
        console.warn('[SyncService] Unknown message type:', parsed);
    }
  }

  /**
   * Helper method to update and persist lastSync data.
   */
  public getLastSync(deviceId: DeviceId): Date | undefined {
    return this.lastSync[deviceId];
  }

  public setLastSync(deviceId: DeviceId, date: Date): void {
    this.lastSync[deviceId] = date;
    console.log('[SyncService] Last sync updated for device:', deviceId, 'date:', date);
  }

  /**
   * Reset the sync service state.
   */
  public reset() {
    this.network.reset();
    this.lastSync = {}
  };
}




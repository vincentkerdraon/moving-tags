export interface DeviceIdMessage {
    type: 'deviceId';
    deviceId: string;
}

export interface LastSyncMessage {
    type: 'lastSync';
    deviceId: string;
    forDevice: string;
    lastSync: string;
}

export interface ItemSyncMessage {
    type: 'item-sync';
    deltas: any[];
    from: string;
    to: string;
}

export interface ImageSyncMessage {
    type: 'image-sync';
    photos: { id: string; data: any }[];
    from: string;
    to: string;
}

export type NetworkMessage = DeviceIdMessage | LastSyncMessage | ItemSyncMessage | ImageSyncMessage;
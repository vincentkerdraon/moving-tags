export type Id = string;
export type PhotoId = string;
export type DeviceId = string;
export type ItemTag = string;
export type ChecklistTag = string;
export enum DestinationTag {
  Bedroom = 'bedroom',
  LivingRoom = 'living room',
  Kitchen = 'kitchen',
  Bathroom = 'bathroom'
}
export enum ItemAction {
  add = "add", remove = "remove", update = "update"
}

export interface Photo {
  id: PhotoId;
  data: string; // Base64 encoded binary data
}

export interface Item {
  id: Id;
  itemTags: ItemTag[];
  checklistTags: ChecklistTag[];
  photos: PhotoId[];
  weight?: number; // Optional weight in kg
  destination?: DestinationTag;
}

export interface AppData {
  items: Item[];
  photos: Photo[];
  itemDeltas: ItemDelta[];
}

export interface ItemDelta {
  time: Date;
  id: Id;
  action: ItemAction;
  deviceId: DeviceId;

  itemTagsAdded?: ItemTag[];
  itemTagsRemoved?: ItemTag[];
  checklistTagsAdded?: ChecklistTag[];
  checklistTagsRemoved?: ChecklistTag[];
  photosAdded?: PhotoId[];
  photosRemoved?: PhotoId[];
  weight?: number;
  destination?: DestinationTag;
}
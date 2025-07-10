export type Id = string;
export type ItemTag = string;
export type ChecklistTag = string;
export enum DestinationTag {
  Bedroom = 'bedroom',
  LivingRoom = 'living room',
  Kitchen = 'kitchen',
  Bathroom = 'bathroom'
}

export interface Photo {
  data: string; // Base64 encoded binary data
}

export interface Item {
  id: Id;
  itemTags: ItemTag[];
  checklistTags: ChecklistTag[];
  photos: Photo[];
  weight?: number; // Optional weight in kg
  destination?: DestinationTag;
}

export interface AppData {
  items: Item[];
}

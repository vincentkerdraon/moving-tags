export type Id = string;
export type ItemTag = string;
export type ChecklistTag = string;

export interface Photo {
  data: string; // Base64 encoded binary data
}

export interface Item {
  id: Id;
  itemTags: ItemTag[];
  checklistTags: ChecklistTag[];
  photos: Photo[];
}

export interface AppData {
  items: Item[];
}

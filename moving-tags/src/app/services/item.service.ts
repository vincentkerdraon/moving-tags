import { Injectable } from '@angular/core';
import { ChecklistTag, ClientId, DestinationTag, Item, ItemAction, ItemDelta, ItemTag } from '../models/data.models';
import { ImageService } from './image.service';
import { SyncService } from './sync.service';

function generateClientId(): ClientId {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

@Injectable({ providedIn: 'root' })
export class ItemService {
  private _items: Item[] = [];
  private _itemDeltas: ItemDelta[] = [];
  allItemTags: Set<ItemTag> = new Set();
  allChecklistTags: Set<ChecklistTag> = new Set();
  
  private static readonly STORAGE_KEY = 'items';
  private static readonly DELTAS_KEY = 'itemDeltas';

  constructor(private imageService: ImageService, private syncService: SyncService) {
    const storedItems = localStorage.getItem(ItemService.STORAGE_KEY);
    if (storedItems) {
      try {
        this._items = JSON.parse(storedItems);
      } catch {
        this._items = [];
      }
    }
    const storedDeltas = localStorage.getItem(ItemService.DELTAS_KEY);
    if (storedDeltas) {
      try {
        this._itemDeltas = JSON.parse(storedDeltas);
      } catch {
        this._itemDeltas = [];
      }
    }
  }

  private persist() {
    localStorage.setItem(ItemService.STORAGE_KEY, JSON.stringify(this._items));
    localStorage.setItem(ItemService.DELTAS_KEY, JSON.stringify(this._itemDeltas));
  }

  get items(): Item[] {
    return this._items;
  }

  get itemDeltas(): ItemDelta[] {
    return this._itemDeltas;
  }

  /**
   * Save an item. Computes the diff, updates the item, and records the delta.
   * Returns an error string if validation fails, otherwise void.
   */
  save(item: Item): string | void {
    console.log('Saving item:', item);
    if (!item.id || !item.id.trim()) {
      return 'Item id is required.';
    }
    const idx = this._items.findIndex(i => i.id === item.id);
    if (idx === -1 && this._items.some(i => i.id === item.id)) {
      return 'Duplicate item id.';
    }
    const now = new Date();
    let prev: Item | undefined;
    if (idx !== -1) {
      prev = this._items[idx];
      this._items[idx] = { ...item };
    } else {
      this._items.push({ ...item });
    }
    // Update tag sets for autocompletion
    item.itemTags.forEach(t => this.allItemTags.add(t));
    item.checklistTags.forEach(t => this.allChecklistTags.add(t));
    // Compute delta
    const itemTagsAdded = prev ? item.itemTags.filter(t => !prev!.itemTags.includes(t)) : item.itemTags;
    const itemTagsRemoved = prev ? prev!.itemTags.filter(t => !item.itemTags.includes(t)) : [];
    const checklistTagsAdded = prev ? item.checklistTags.filter(t => !prev!.checklistTags.includes(t)) : item.checklistTags;
    const checklistTagsRemoved = prev ? prev!.checklistTags.filter(t => !item.checklistTags.includes(t)) : [];
    const photosAdded = prev ? item.photos.filter(p => !prev!.photos.includes(p)) : item.photos;
    const photosRemoved = prev ? prev!.photos.filter(p => !item.photos.includes(p)) : [];
    const delta: ItemDelta = {
      time: now,
      id: item.id,
      action: idx === -1 ? ItemAction.add : ItemAction.update,
      client: this.syncService.clientId,
      ...(itemTagsAdded.length ? { itemTagsAdded } : {}),
      ...(itemTagsRemoved.length ? { itemTagsRemoved } : {}),
      ...(checklistTagsAdded.length ? { checklistTagsAdded } : {}),
      ...(checklistTagsRemoved.length ? { checklistTagsRemoved } : {}),
      ...(photosAdded.length ? { photosAdded } : {}),
      ...(photosRemoved.length ? { photosRemoved } : {}),
      ...(item.weight !== undefined ? { weight: item.weight } : {}),
      ...(item.destination !== undefined ? { destination: item.destination } : {})
    };
    this._itemDeltas.push(delta);
    this.persist();
  }

  /**
   * Remove an item by id and record a delta.
   */
  removeItem(id: string) {
    console.log('removeItem item:', id);
    const idx = this._items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const item = this._items[idx];
      this._items.splice(idx, 1);
      const now = new Date();
      const delta: ItemDelta = {
        time: now,
        id,
        action: ItemAction.remove,
        client: this.syncService.clientId,
        ...(item.itemTags.length ? { itemTagsRemoved: item.itemTags } : {}),
        ...(item.checklistTags.length ? { checklistTagsRemoved: item.checklistTags } : {}),
        ...(item.photos.length ? { photosRemoved: item.photos } : {}),
        ...(item.weight !== undefined ? { weight: item.weight } : {}),
        ...(item.destination !== undefined ? { destination: item.destination } : {})
      };
      this._itemDeltas.push(delta);
      this.persist();
    }
  }

  /**
   * Rebuild tag sets for autocompletion (call after bulk import or sync).
   */
  rebuildTagSets() {
    this.allItemTags.clear();
    this.allChecklistTags.clear();
    for (const item of this._items) {
      item.itemTags.forEach(t => this.allItemTags.add(t));
      item.checklistTags.forEach(t => this.allChecklistTags.add(t));
    }
  }

  generateFakeData() {
    if (this._items.length > 0) return;
    const checkpointTag = 'ready for movers';
    const itemTags = ['kitchen', 'fragile', 'books', 'clothes', 'electronics', 'bathroom', 'toys', 'office', 'decor', 'misc'];
    const destinations = Object.values(DestinationTag);
    for (let i = 1; i <= 20; i++) {
      const tags = [itemTags[Math.floor(Math.random() * itemTags.length)]];
      if (i % 4 === 0) {
        const extraCount = Math.floor(Math.random() * 5) + 1;
        for (let j = 0; j < extraCount; j++) {
          const tag = itemTags[Math.floor(Math.random() * itemTags.length)];
          if (!tags.includes(tag)) tags.push(tag);
        }
      }
      // Randomly assign a weight to some items
      const hasWeight = Math.random() < 0.6; // 60% chance to have a weight
      const weight = hasWeight ? +(Math.random() * 30 + 1).toFixed(1) : undefined;
      // Randomly assign a destination to some items
      const hasDestination = Math.random() < 0.6; // 60% chance to have a destination
      const destination = hasDestination ? destinations[Math.floor(Math.random() * destinations.length)] : undefined;
      this.save({
        id: `${i.toString().padStart(3, '0')}`,
        itemTags: tags,
        checklistTags: [checkpointTag],
        photos: [],
        ...(weight !== undefined ? { weight } : {}),
        ...(destination !== undefined ? { destination } : {})
      });
    }
  }

  reset() {
    this._items = [];
    this._itemDeltas = [];
    this.allItemTags.clear();
    this.allChecklistTags.clear();
    localStorage.removeItem(ItemService.STORAGE_KEY);
    localStorage.removeItem(ItemService.DELTAS_KEY);
  }
}

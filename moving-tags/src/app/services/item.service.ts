import { Injectable } from '@angular/core';
import { Item } from '../models/data.models';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private _items: Item[] = [];

  get items(): Item[] {
    return this._items;
  }

  generateFakeData() {
    if (this._items.length > 0) return;
    const checkpointTag = 'ready for movers';
    const itemTags = ['kitchen', 'fragile', 'books', 'clothes', 'electronics', 'bathroom', 'toys', 'office', 'decor', 'misc'];
    for (let i = 1; i <= 20; i++) {
      const tags = [itemTags[Math.floor(Math.random() * itemTags.length)]];
      if (i % 4 === 0) {
        const extraCount = Math.floor(Math.random() * 5) + 1;
        for (let j = 0; j < extraCount; j++) {
          const tag = itemTags[Math.floor(Math.random() * itemTags.length)];
          if (!tags.includes(tag)) tags.push(tag);
        }
      }
      this._items.push({
        id: `${i.toString().padStart(3, '0')}`,
        itemTags: tags,
        checklistTags: [checkpointTag],
        photos: []
      });
    }
  }
}

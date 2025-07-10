import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { CheckpointComponent } from './components/checkpoint/checkpoint.component';
import { EditItemComponent } from './components/edit-item/edit-item.component';
import { ItemListComponent } from './components/item-list/item-list.component';
import { Item } from './models/data.models';

@Component({
  selector: 'app-root',
  imports: [CommonModule, EditItemComponent, ItemListComponent, CheckpointComponent],
  templateUrl: './app.html',
  styles: [],
  standalone: true,
})
export class App implements OnInit {
  protected readonly title = signal('moving-tags');

  items: Item[] = [];
  selectedId: string | null = null;
  tab: 'edit' | 'list' | 'checkpoint' = 'list';

  ngOnInit() {
    // Add 20 fake items with random tags and the checkpoint tag 'ready for movers'
    const checkpointTag = 'ready for movers';
    const itemTags = ['kitchen', 'fragile', 'books', 'clothes', 'electronics', 'bathroom', 'toys', 'office', 'decor', 'misc'];
    for (let i = 1; i <= 20; i++) {
      const tags = [itemTags[Math.floor(Math.random() * itemTags.length)]];
      // Add up to 5 more random tags for some items
      if (i % 4 === 0) {
        const extraCount = Math.floor(Math.random() * 5) + 1;
        for (let j = 0; j < extraCount; j++) {
          const tag = itemTags[Math.floor(Math.random() * itemTags.length)];
          if (!tags.includes(tag)) tags.push(tag);
        }
      }
      this.items.push({
        id: `item-${i.toString().padStart(2, '0')}`,
        itemTags: tags,
        checklistTags: [checkpointTag],
        photos: []
      });
    }
  }

  // Tab navigation
  setTab(tab: 'edit' | 'list' | 'checkpoint') {
    this.tab = tab;
    if (tab === 'edit' && !this.selectedId) {
      this.selectedId = null; // New item
    }
  }

  // Item list events
  onEditItem(id: string) {
    this.selectedId = id;
    this.tab = 'edit';
  }

  onScanQr() {
    // Placeholder: just switch to edit for new item
    this.selectedId = null;
    this.tab = 'edit';
  }

  // Edit item events
  onItemCreated(item: Item) {
    const idx = this.items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      this.items[idx] = item;
    } else {
      this.items.push(item);
    }
  }

  onCancelEdit() {
    this.tab = 'list';
    this.selectedId = null;
  }

  get selectedItem(): Item {
    if (this.selectedId) {
      const found = this.items.find(i => i.id === this.selectedId);
      if (found) return { ...found };
      // If not found, treat as new item with this ID
      return { id: this.selectedId, itemTags: [], checklistTags: [], photos: [] };
    }
    // New item (no ID yet)
    return { id: this.generateId(), itemTags: [], checklistTags: [], photos: [] };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

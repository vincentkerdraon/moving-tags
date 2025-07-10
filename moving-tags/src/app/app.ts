import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { EditItemComponent } from './components/edit-item/edit-item.component';
import { ItemListComponent } from './components/item-list/item-list.component';
import { Item } from './models/data.models';

@Component({
  selector: 'app-root',
  imports: [CommonModule, EditItemComponent, ItemListComponent],
  templateUrl: './app.html',
  styles: [],
  standalone: true,
})
export class App {
  protected readonly title = signal('moving-tags');

  items: Item[] = [];
  selectedId: string | null = null;
  tab: 'edit' | 'list' = 'list';

  // Tab navigation
  setTab(tab: 'edit' | 'list') {
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

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item } from '../../models/data.models';
import { ItemService } from '../../services/item.service';
import { DestinationTagComponent } from '../destination-tag/destination-tag.component';
import { EditItemComponent } from '../edit-item/edit-item.component';
import { InputIdComponent } from '../input-id/input-id.component';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, FormsModule, InputIdComponent, EditItemComponent, DestinationTagComponent],
  templateUrl: './item-list.component.html'
})
export class ItemListComponent {
  @Input() searchId = '';
  @Input() filter = '';
  @Output() editItem = new EventEmitter<string>();
  @Output() scanQr = new EventEmitter<void>();

  editingItem: Item | null = null;

  constructor(public itemService: ItemService) {}

  get items(): Item[] {
    return this.itemService.items;
  }

  onEdit(id: string) {
    const found = this.items.find(item => item.id === id);
    if (found) {
      this.editingItem = { ...found, itemTags: [...found.itemTags], checklistTags: [...found.checklistTags], photos: [...found.photos] };
    }
  }

  onModalSave(edited: Item) {
    this.itemService.save(edited);
    this.editingItem = null;
  }

  onModalCancel() {
    this.editingItem = null;
  }

  onScanQr() {
    this.scanQr.emit();
  }

  onSearch() {
    if (this.searchId.trim()) {
      this.editItem.emit(this.searchId.trim());
    }
  }

  onInputId(id: string) {
    this.editItem.emit(id);
  }

  get filteredItems() {
    const q = this.filter.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(item =>
      item.id.toLowerCase().includes(q) ||
      item.itemTags.some(tag => tag.toLowerCase().includes(q)) ||
      item.checklistTags.some(tag => tag.toLowerCase().includes(q))
    );
  }
}

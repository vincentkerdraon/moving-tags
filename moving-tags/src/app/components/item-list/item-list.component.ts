import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item } from '../../models/data.models';
import { InputIdComponent } from '../input-id/input-id.component';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, FormsModule, InputIdComponent],
  templateUrl: './item-list.component.html'
})
export class ItemListComponent {
  @Input() items: Item[] = [];
  @Output() editItem = new EventEmitter<string>();
  @Output() scanQr = new EventEmitter<void>();

  searchId = '';
  filter = '';

  onEdit(id: string) {
    this.editItem.emit(id);
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

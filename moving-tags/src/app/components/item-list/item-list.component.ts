import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item } from '../../models/data.models';
import { ItemService } from '../../services/item.service';
import { ChecklistTagComponent } from "../checklist-tag/checklist-tag.component";
import { DestinationTagComponent } from '../destination-tag/destination-tag.component';
import { EditItemComponent } from '../edit-item/edit-item.component';
import { ItemTagComponent } from "../item-tag/item-tag.component";
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, FormsModule, EditItemComponent, DestinationTagComponent, QrScannerComponent, ChecklistTagComponent, ItemTagComponent],
  templateUrl: './item-list.component.html'
})
export class ItemListComponent {
  @Input() searchId = '';
  @Input() filter = '';
  @Output() editItem = new EventEmitter<string>();
  @Output() scanQr = new EventEmitter<void>();

  editingItem: Item | null = null;
  newItemId = '';
  showQrScanner = false;

  constructor(public itemService: ItemService) { }

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
    this.showQrScanner = true;
  }

  onQrScanResult(result: string) {
    this.showQrScanner = false;
    if (result && result.trim()) {
      this.newItemId = result.trim();
      this.onCreateNewItem();
    }
  }

  onQrScanClose() {
    this.showQrScanner = false;
  }

  onSearch() {
    if (this.searchId.trim()) {
      this.editItem.emit(this.searchId.trim());
    }
  }

  onInputId(id: string) {
    // Find existing item or create a new one
    const found = this.items.find(item => item.id === id);
    if (found) {
      // Edit existing item
      this.editingItem = { ...found, itemTags: [...found.itemTags], checklistTags: [...found.checklistTags], photos: [...found.photos] };
    } else {
      // Create new item with the provided ID
      this.editingItem = {
        id: id,
        itemTags: [],
        checklistTags: [],
        photos: [],
        destination: undefined,
        weight: undefined
      };
    }
  }

  onCreateNewItem() {
    const id = this.newItemId.trim();
    if (!id) return;

    // Check if item already exists
    const found = this.items.find(item => item.id === id);
    if (found) {
      // Edit existing item
      this.editingItem = { ...found, itemTags: [...found.itemTags], checklistTags: [...found.checklistTags], photos: [...found.photos] };
    } else {
      // Create new item with the provided ID
      this.editingItem = {
        id: id,
        itemTags: [],
        checklistTags: [],
        photos: [],
        destination: undefined,
        weight: undefined
      };
    }

    // Clear the input field
    this.newItemId = '';
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

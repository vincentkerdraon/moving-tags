import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item } from '../../models/data.models';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-list.component.html'
})
export class ItemListComponent {
  @Input() items: Item[] = [];
  @Output() editItem = new EventEmitter<string>();
  @Output() scanQr = new EventEmitter<void>();

  searchId = '';

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
}

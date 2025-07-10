import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTag, Item, ItemTag } from '../../models/data.models';
import { ChecklistTagComponent } from '../checklist-tag/checklist-tag.component';
import { ItemTagComponent } from '../item-tag/item-tag.component';

@Component({
  selector: 'app-create-item',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemTagComponent, ChecklistTagComponent],
  templateUrl: './create-item.component.html'
})
export class CreateItemComponent implements OnInit {
  @Input() existingItemTags: ItemTag[] = [];
  @Input() existingChecklistTags: ChecklistTag[] = [];
  @Output() itemCreated = new EventEmitter<Item>();
  @Output() cancelled = new EventEmitter<void>();

  item: Item = {
    id: '',
    itemTags: [],
    checklistTags: [],
    photos: []
  };

  newItemTag = '';
  newChecklistTag = '';
  itemTagSuggestions: ItemTag[] = [];
  checklistTagSuggestions: ChecklistTag[] = [];
  confirmDelete = false;

  ngOnInit() {
    // Generate a default ID if none provided
    if (!this.item.id) {
      this.item.id = this.generateId();
    }
  }

  onScanQR() {
    // TODO: Implement QR code scanning
    // For now, generate a random ID
    this.item.id = this.generateId();
    alert('QR scanning not implemented yet. Generated ID: ' + this.item.id);
  }

  addItemTag() {
    if (this.newItemTag && this.newItemTag.trim() && !this.item.itemTags.includes(this.newItemTag.trim())) {
      this.item.itemTags.push(this.newItemTag.trim());
      this.newItemTag = '';
      this.itemTagSuggestions = [];
    }
  }

  addChecklistTag() {
    if (this.newChecklistTag && this.newChecklistTag.trim() && !this.item.checklistTags.includes(this.newChecklistTag.trim())) {
      this.item.checklistTags.push(this.newChecklistTag.trim());
      this.newChecklistTag = '';
      this.checklistTagSuggestions = [];
    }
  }

  removeItemTag(tag: ItemTag) {
    this.item.itemTags = this.item.itemTags.filter(t => t !== tag);
  }

  removeChecklistTag(tag: ChecklistTag) {
    this.item.checklistTags = this.item.checklistTags.filter(t => t !== tag);
  }

  addSuggestedItemTag(tag: ItemTag) {
    if (!this.item.itemTags.includes(tag)) {
      this.item.itemTags.push(tag);
    }
    this.itemTagSuggestions = [];
  }

  addSuggestedChecklistTag(tag: ChecklistTag) {
    if (!this.item.checklistTags.includes(tag)) {
      this.item.checklistTags.push(tag);
    }
    this.checklistTagSuggestions = [];
  }

  onItemTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0) {
      this.itemTagSuggestions = this.existingItemTags
        .filter(tag => 
          tag.toLowerCase().includes(input) && 
          !this.item.itemTags.includes(tag)
        )
        .slice(0, 5);
    } else {
      this.itemTagSuggestions = [];
    }
  }

  onChecklistTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0) {
      this.checklistTagSuggestions = this.existingChecklistTags
        .filter(tag => 
          tag.toLowerCase().includes(input) && 
          !this.item.checklistTags.includes(tag)
        )
        .slice(0, 5);
    } else {
      this.checklistTagSuggestions = [];
    }
  }

  onSubmit() {
    if (this.item.id) {
      this.itemCreated.emit({ ...this.item });
    }
  }

  onCancel() {
    this.cancelled.emit();
  }

  onPhotoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const files = Array.from(input.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        this.item.photos.push({ data: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  onDeleteItem() {
    // Clear the item and close the modal
    this.item = { id: '', itemTags: [], checklistTags: [], photos: [] };
    this.confirmDelete = false;
    // Optionally emit a delete event or handle as needed
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

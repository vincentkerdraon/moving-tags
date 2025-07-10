import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTag, Item, ItemTag } from '../../models/data.models';

@Component({
  selector: 'app-edit-item',
  standalone: true,
  imports: [CommonModule, FormsModule,  ],
  templateUrl: './edit-item.component.html'
})
export class EditItemComponent implements OnInit {
  @Input() existingItemTags: ItemTag[] = [];
  @Input() existingChecklistTags: ChecklistTag[] = [];
  @Output() itemCreated = new EventEmitter<Item>();
  @Output() cancelled = new EventEmitter<void>();

  @Input() item!: Item;

  newItemTag = '';
  newChecklistTag = '';
  itemTagSuggestions: ItemTag[] = [];
  checklistTagSuggestions: ChecklistTag[] = [];
  confirmDelete = false;

  ngOnInit() {
    this.item = { ...this.item };
  }

  private upsertItem() {
    if (this.item && this.item.id) {
      this.itemCreated.emit({ ...this.item } as Item);
    }
  }

  addItemTag() {
    if (this.item && this.newItemTag && this.newItemTag.trim() && !this.item.itemTags.includes(this.newItemTag.trim())) {
      this.item.itemTags.push(this.newItemTag.trim());
      this.newItemTag = '';
      this.itemTagSuggestions = [];
      this.upsertItem();
    }
  }

  addChecklistTag() {
    if (this.item && this.newChecklistTag && this.newChecklistTag.trim() && !this.item.checklistTags.includes(this.newChecklistTag.trim())) {
      this.item.checklistTags.push(this.newChecklistTag.trim());
      this.newChecklistTag = '';
      this.checklistTagSuggestions = [];
      this.upsertItem();
    }
  }

  removeItemTag(tag: ItemTag) {
    if (this.item) {
      this.item.itemTags = this.item.itemTags.filter(t => t !== tag);
      this.upsertItem();
    }
  }

  removeChecklistTag(tag: ChecklistTag) {
    if (this.item) {
      this.item.checklistTags = this.item.checklistTags.filter(t => t !== tag);
      this.upsertItem();
    }
  }

  addSuggestedItemTag(tag: ItemTag) {
    if (this.item && !this.item.itemTags.includes(tag)) {
      this.item.itemTags.push(tag);
      this.upsertItem();
    }
    this.itemTagSuggestions = [];
  }

  addSuggestedChecklistTag(tag: ChecklistTag) {
    if (this.item && !this.item.checklistTags.includes(tag)) {
      this.item.checklistTags.push(tag);
      this.upsertItem();
    }
    this.checklistTagSuggestions = [];
  }

  onItemTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0 && this.item) {
      this.itemTagSuggestions = this.existingItemTags
        .filter(tag => 
          tag.toLowerCase().includes(input) && 
          !this.item!.itemTags.includes(tag)
        )
        .slice(0, 5);
    } else {
      this.itemTagSuggestions = [];
    }
  }

  onChecklistTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0 && this.item) {
      this.checklistTagSuggestions = this.existingChecklistTags
        .filter(tag => 
          tag.toLowerCase().includes(input) && 
          !this.item!.checklistTags.includes(tag)
        )
        .slice(0, 5);
    } else {
      this.checklistTagSuggestions = [];
    }
  }

  onPhotoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.item) return;
    const files = Array.from(input.files);
    let loaded = 0;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        this.item!.photos.push({ data: reader.result as string });
        loaded++;
        if (loaded === files.length) {
          this.upsertItem();
        }
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  onDeleteItem() {
    this.item = { id: '', itemTags: [], checklistTags: [], photos: [] };
    this.confirmDelete = false;
  }

  onCancel() {
    // Optionally emit a cancel event or handle navigation
    this.cancelled.emit();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

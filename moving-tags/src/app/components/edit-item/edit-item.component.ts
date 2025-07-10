import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTag, DestinationTag, Item, ItemTag } from '../../models/data.models';

@Component({
  selector: 'app-edit-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-item.component.html'
})
export class EditItemComponent implements OnInit, OnChanges {
  @Input() existingItemTags: ItemTag[] = [];
  @Input() existingChecklistTags: ChecklistTag[] = [];
  @Input() allItemTags: ItemTag[] = [];
  @Input() allChecklistTags: ChecklistTag[] = [];
  @Input() item!: Item;
  @Input() items: Item[] = [];
  @Output() itemCreated = new EventEmitter<Item>();
  @Output() cancelled = new EventEmitter<void>();

  newItemTag = '';
  newChecklistTag = '';
  itemTagSuggestions: ItemTag[] = [];
  checklistTagSuggestions: ChecklistTag[] = [];
  confirmDelete = false;
  destinationOptions = Object.values(DestinationTag);

  ngOnInit() {
    this.item = { ...this.item };
    this.populateAllTags();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items'] && this.items) {
      this.populateAllTags();
    }
  }

  private populateAllTags() {
    if ((!this.allItemTags.length || !this.allChecklistTags.length) && this.items && this.items.length) {
      if (!this.allItemTags.length) {
        this.allItemTags = Array.from(new Set(this.items.flatMap(i => i.itemTags)));
      }
      if (!this.allChecklistTags.length) {
        this.allChecklistTags = Array.from(new Set(this.items.flatMap(i => i.checklistTags)));
      }
    }
  }

  save() {
    if (this.item && this.item.id) {
      this.itemCreated.emit({ ...this.item } as Item);
    }
  }

  addItemTag() {
    if (this.item && this.newItemTag && this.newItemTag.trim() && !this.item.itemTags.includes(this.newItemTag.trim())) {
      this.item.itemTags.push(this.newItemTag.trim());
      this.newItemTag = '';
      this.itemTagSuggestions = [];
    }
  }

  addChecklistTag() {
    if (this.item && this.newChecklistTag && this.newChecklistTag.trim() && !this.item.checklistTags.includes(this.newChecklistTag.trim())) {
      this.item.checklistTags.push(this.newChecklistTag.trim());
      this.newChecklistTag = '';
      this.checklistTagSuggestions = [];
    }
  }

  removeItemTag(tag: ItemTag) {
    if (this.item) {
      this.item.itemTags = this.item.itemTags.filter(t => t !== tag);
    }
  }

  removeChecklistTag(tag: ChecklistTag) {
    if (this.item) {
      this.item.checklistTags = this.item.checklistTags.filter(t => t !== tag);
    }
  }

  onItemTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0 && this.item) {
      this.itemTagSuggestions = this.allItemTags
        .filter(tag => {
          const tagNorm = tag.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
          const inputNorm = input.normalize('NFD').replace(/\p{Diacritic}/gu, '');
          return tagNorm.includes(inputNorm) && !this.item.itemTags.includes(tag);
        })
        .slice(0, 5);
    } else {
      this.itemTagSuggestions = [];
    }
  }

  addSuggestedItemTag(tag: ItemTag) {
    if (this.item && !this.item.itemTags.includes(tag)) {
      this.item.itemTags.push(tag);
    }
    this.newItemTag = '';
    this.itemTagSuggestions = [];
  }

  onChecklistTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0 && this.item) {
      this.checklistTagSuggestions = this.allChecklistTags
        .filter(tag => 
          tag.toLowerCase().includes(input) && 
          !this.item.checklistTags.includes(tag)
        )
        .slice(0, 5);
    } else {
      this.checklistTagSuggestions = [];
    }
  }

  addSuggestedChecklistTag(tag: ChecklistTag) {
    if (this.item && !this.item.checklistTags.includes(tag)) {
      this.item.checklistTags.push(tag);
    }
    this.newChecklistTag = '';
    this.checklistTagSuggestions = [];
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
    this.cancelled.emit();
  }
}

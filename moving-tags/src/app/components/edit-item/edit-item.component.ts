import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTag, DestinationTag, Item, ItemTag } from '../../models/data.models';
import { ErrorService } from '../../services/error.service';
import { ItemService } from '../../services/item.service';

@Component({
  selector: 'app-edit-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-item.component.html'
})
export class EditItemComponent implements OnInit {
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

  constructor(public itemService: ItemService, private errorService: ErrorService) {}

  ngOnInit() {}

  save() {
    if (this.item && this.item.id) {
      const err = this.itemService.save(this.item);
      if (err) {
        this.errorService.showError(err);
        return;
      }
      this.itemCreated.emit({ ...this.item });
    }
  }

  addItemTag() {
    const tag = this.newItemTag.trim();
    if (this.item && tag && !this.item.itemTags.includes(tag)) {
      const updated = { ...this.item, itemTags: [...this.item.itemTags, tag] };
      const err = this.itemService.save(updated);
      if (err) {
        this.errorService.showError(err);
        return;
      }
      this.newItemTag = '';
      this.itemTagSuggestions = [];
    }
  }

  addChecklistTag() {
    const tag = this.newChecklistTag.trim();
    if (this.item && tag && !this.item.checklistTags.includes(tag)) {
      const updated = { ...this.item, checklistTags: [...this.item.checklistTags, tag] };
      const err = this.itemService.save(updated);
      if (err) {
        this.errorService.showError(err);
        return;
      }
      this.newChecklistTag = '';
      this.checklistTagSuggestions = [];
    }
  }

  removeItemTag(tag: ItemTag) {
    if (this.item) {
      const updated = { ...this.item, itemTags: this.item.itemTags.filter(t => t !== tag) };
      const err = this.itemService.save(updated);
      if (err) {
        this.errorService.showError(err);
        return;
      }
    }
  }

  removeChecklistTag(tag: ChecklistTag) {
    if (this.item) {
      const updated = { ...this.item, checklistTags: this.item.checklistTags.filter(t => t !== tag) };
      const err = this.itemService.save(updated);
      if (err) {
        this.errorService.showError(err);
        return;
      }
    }
  }

  onItemTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0) {
      this.itemTagSuggestions = Array.from(this.itemService.allItemTags)
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
      const updated = { ...this.item, itemTags: [...this.item.itemTags, tag] };
      const err = this.itemService.save(updated);
      if (err) {
        this.errorService.showError(err);
        return;
      }
    }
    this.newItemTag = '';
    this.itemTagSuggestions = [];
  }

  onChecklistTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0) {
      this.checklistTagSuggestions = Array.from(this.itemService.allChecklistTags)
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
      const updated = { ...this.item, checklistTags: [...this.item.checklistTags, tag] };
      const err = this.itemService.save(updated);
      if (err) {
        this.errorService.showError(err);
        return;
      }
    }
    this.newChecklistTag = '';
    this.checklistTagSuggestions = [];
  }

  onPhotoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.item) return;
    const files = Array.from(input.files);
    let updatedPhotos = [...this.item.photos];
    let loaded = 0;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        updatedPhotos.push(reader.result as string);
        loaded++;
        if (loaded === files.length) {
          const updated = { ...this.item, photos: updatedPhotos };
          const err = this.itemService.save(updated);
          if (err) {
            this.errorService.showError(err);
            return;
          }
        }
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  onDeleteItem() {
    if (this.item && this.item.id) {
      this.itemService.removeItem(this.item.id);
      this.confirmDelete = false;
    }
  }

  onCancel() {
    this.cancelled.emit();
  }
}

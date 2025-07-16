import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTag, DestinationTag, Item, ItemTag } from '../../models/data.models';
import { ErrorService } from '../../services/error.service';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';

@Component({
  selector: 'app-edit-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-item.component.html'
})
export class EditItemComponent implements OnInit {
  @Input() item!: Item;
  @Output() itemCreated = new EventEmitter<Item>();
  @Output() cancelled = new EventEmitter<void>();

  // Local working copy of the item
  localItem!: Item;
  
  newItemTag = '';
  newChecklistTag = '';
  itemTagSuggestions: ItemTag[] = [];
  checklistTagSuggestions: ChecklistTag[] = [];
  confirmDelete = false;
  destinationOptions = Object.values(DestinationTag);

  constructor(public itemService: ItemService, private errorService: ErrorService, private cdr: ChangeDetectorRef, public imageService: ImageService) {}

  ngOnInit() {
    // Create a deep copy of the item for local editing
    this.localItem = {
      ...this.item,
      itemTags: [...this.item.itemTags],
      checklistTags: [...this.item.checklistTags],
      photos: [...this.item.photos]
    };
  }

  save() {
    if (this.localItem && this.localItem.id) {
      // Treat 0 as no value for weight
      const itemToSave = {
        ...this.localItem,
        weight: (this.localItem.weight === 0 ? undefined : this.localItem.weight)
      };
      const err = this.itemService.save(itemToSave);
      if (err) {
        this.errorService.showError(err);
        return;
      }
      
      // Update the original item reference and emit the changes
      this.item = { ...itemToSave };
      this.itemCreated.emit({ ...this.item });
    }
  }

  addItemTag() {
    const tag = this.newItemTag.trim();
    if (this.localItem && tag && !this.localItem.itemTags.includes(tag)) {
      this.localItem.itemTags = [...this.localItem.itemTags, tag];
      this.newItemTag = '';
      this.itemTagSuggestions = [];
    }
  }

  addChecklistTag() {
    const tag = this.newChecklistTag.trim();
    if (this.localItem && tag && !this.localItem.checklistTags.includes(tag)) {
      this.localItem.checklistTags = [...this.localItem.checklistTags, tag];
      this.newChecklistTag = '';
      this.checklistTagSuggestions = [];
    }
  }

  removeItemTag(tag: ItemTag) {
    if (this.localItem) {
      this.localItem.itemTags = this.localItem.itemTags.filter(t => t !== tag);
    }
  }

  removeChecklistTag(tag: ChecklistTag) {
    if (this.localItem) {
      this.localItem.checklistTags = this.localItem.checklistTags.filter(t => t !== tag);
    }
  }

  onItemTagInput(event: any) {
    const input = event.target.value.toLowerCase();
    if (input.length > 0) {
      this.itemTagSuggestions = Array.from(this.itemService.allItemTags)
        .filter(tag => {
          const tagNorm = tag.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
          const inputNorm = input.normalize('NFD').replace(/\p{Diacritic}/gu, '');
          return tagNorm.includes(inputNorm) && !this.localItem.itemTags.includes(tag);
        })
        .slice(0, 5);
    } else {
      this.itemTagSuggestions = [];
    }
  }

  addSuggestedItemTag(tag: ItemTag) {
    if (this.localItem && !this.localItem.itemTags.includes(tag)) {
      this.localItem.itemTags = [...this.localItem.itemTags, tag];
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
          !this.localItem.checklistTags.includes(tag)
        )
        .slice(0, 5);
    } else {
      this.checklistTagSuggestions = [];
    }
  }

  addSuggestedChecklistTag(tag: ChecklistTag) {
    if (this.localItem && !this.localItem.checklistTags.includes(tag)) {
      this.localItem.checklistTags = [...this.localItem.checklistTags, tag];
    }
    this.newChecklistTag = '';
    this.checklistTagSuggestions = [];
  }

  async onPhotoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.localItem) {
      return;
    }
    const files = Array.from(input.files);
    let updatedPhotos = [...this.localItem.photos];
    let loaded = 0;
    for (const file of files) {
      try {
        const base64 = await this.imageService.processImage(file);
        const photoId = this.imageService.addPhoto(base64);
        updatedPhotos.push(photoId);
        loaded++;
        if (loaded === files.length) {
          this.localItem.photos = updatedPhotos;
          this.cdr.detectChanges();
        }
      } catch (err) {
        this.errorService.showError('Photo processing failed.');
      }
    }
    input.value = '';
  }

  onDeleteItem() {
    if (this.localItem && this.localItem.id) {
      this.itemService.removeItem(this.localItem.id);
      this.confirmDelete = false;
    }
  }

  onCancel() {
    this.cancelled.emit();
  }

  get photoColumns(): string[][] {
    const cols: string[][] = [[], [], [], []];
    this.localItem.photos.forEach((photoId, i) => {
      cols[i % 4].push(photoId);
    });
    return cols;
  }

  getPhotoColumns(count: number): string[][] {
    const cols: string[][] = Array.from({ length: count }, () => []);
    this.item.photos.forEach((photoId, i) => {
      cols[i % count].push(photoId);
    });
    return cols;
  }
}

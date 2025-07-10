import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChecklistTag, Item } from '../../models/data.models';
import { ItemService } from '../../services/item.service';
import { EditItemComponent } from '../edit-item/edit-item.component';
import { InputIdComponent } from '../input-id/input-id.component';

@Component({
  selector: 'app-checkpoint',
  standalone: true,
  imports: [CommonModule, FormsModule, InputIdComponent, EditItemComponent],
  templateUrl: './checkpoint.component.html',
})
export class CheckpointComponent {
  items: Item[] = [];
  @Input() allTags: ChecklistTag[] = [];
  doneIds: Set<string> = new Set();
  selectedTag: ChecklistTag = '';
  tagInput: string = '';
  tagSelected = false;
  @Input() openEdit: (id: string) => void = () => {};

  popupItem: Item | null = null;
  popupTimeout: any;
  popupProgress = 100;
  popupInterval: any;
  popupPreventClose = false;
  popupStart = 0;
  idParam: string | null = null;
  editingItem: Item | null = null;
  popupError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private itemService: ItemService
  ) {
    this.items = this.itemService.items;
    this.route.paramMap.subscribe(params => {
      this.idParam = params.get('id');
      if (this.idParam) {
        this.tagInput = this.idParam;
        this.selectedTag = this.idParam;
        this.tagSelected = true;
      }
    });
  }

  get tagList(): ChecklistTag[] {
    return Array.from(new Set([...this.allTags, ...this.items.flatMap(i => i.checklistTags)]));
  }

  onSelectTag(tag: string) {
    this.selectedTag = tag;
    this.tagInput = tag;
    this.tagSelected = !!tag;
    // Update the URL with the selected tag
    this.router.navigate(['/checkpoint', tag]);
  }

  onTagInputChange(value: string) {
    this.tagInput = value;
    this.selectedTag = value;
    this.tagSelected = false;
  }

  showPopup(item: Item | null) {
    if (!item) {
      this.popupItem = null;
      this.popupError = 'Item not found.';
      setTimeout(() => {
        this.popupError = null;
        this.cdr.detectChanges();
      }, 2000);
      this.cdr.detectChanges();
      return;
    }
    this.popupError = null;
    this.popupItem = item;
    this.popupPreventClose = false;
    this.popupProgress = 100;
    clearTimeout(this.popupTimeout);
    if (this.popupInterval) clearInterval(this.popupInterval);
    this.popupStart = Date.now();
    const duration = 2500;
    this.popupInterval = setInterval(() => {
      if (!this.popupItem || this.popupPreventClose) return;
      const elapsed = Date.now() - this.popupStart;
      this.popupProgress = Math.max(0, 100 - (elapsed / duration) * 100);
      this.cdr.detectChanges();
      if (this.popupProgress <= 0) {
        this.popupProgress = 0;
        this.popupItem = null;
        clearInterval(this.popupInterval);
        this.cdr.detectChanges();
      }
    }, 200);
  }

  preventPopupClose() {
    this.popupPreventClose = true;
    clearTimeout(this.popupTimeout);
    this.popupProgress=0
    this.popupInterval=null;
    this.cdr.detectChanges();
  }

  closePopup() {
    this.popupItem = null;
    this.popupProgress = 100;
    clearTimeout(this.popupTimeout);
    this.popupProgress=0
    this.popupInterval=null;
    this.cdr.detectChanges();
  }

  onSubmitId(id: string) {
    if (!this.selectedTag) return;
    const item = this.items.find(i => i.id === id);
    if (item && !item.checklistTags.includes(this.selectedTag)) {
      item.checklistTags.push(this.selectedTag);
    }
    this.showPopup(item || null);
  }

  onScanQr() {}

  onItemClick(id: string) {
    this.onSubmitId(id);
  }

  get remaining() {
    if (!this.selectedTag) return this.items.slice().sort((a, b) => a.id.localeCompare(b.id));
    return this.items.filter(item => !item.checklistTags.includes(this.selectedTag)).sort((a, b) => a.id.localeCompare(b.id));
  }

  get done() {
    if (!this.selectedTag) return [];
    return this.items.filter(item => item.checklistTags.includes(this.selectedTag)).sort((a, b) => a.id.localeCompare(b.id));
  }

  onUndoDone(item: Item) {
    if (!this.selectedTag) return;
    const idx = item.checklistTags.indexOf(this.selectedTag);
    if (idx >= 0) {
      item.checklistTags.splice(idx, 1);
    }
  }

  openEditModal(id: string) {
    const found = this.items.find(item => item.id === id);
    if (found) {
      this.editingItem = { ...found, itemTags: [...found.itemTags], checklistTags: [...found.checklistTags], photos: [...found.photos] };
    }
  }

  onModalSave(edited: Item) {
    const idx = this.items.findIndex(item => item.id === edited.id);
    if (idx !== -1) {
      this.items[idx] = { ...edited };
    }
    this.editingItem = null;
  }

  onModalCancel() {
    this.editingItem = null;
  }
}

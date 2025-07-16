import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChecklistTag, Item } from '../../models/data.models';
import { ItemService } from '../../services/item.service';
import { ChecklistTagComponent } from '../checklist-tag/checklist-tag.component';
import { CheckpointValidationComponent } from '../checkpoint-validation/checkpoint-validation.component';
import { EditItemComponent } from '../edit-item/edit-item.component';
import { InputIdComponent } from '../input-id/input-id.component';

@Component({
  selector: 'app-checkpoint',
  standalone: true,
  imports: [CommonModule, FormsModule, InputIdComponent, EditItemComponent, CheckpointValidationComponent, ChecklistTagComponent, ],
  templateUrl: './checkpoint.component.html',
})
export class CheckpointComponent {
  checkpointId: ChecklistTag = '';
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
  tagInput: string = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    public itemService: ItemService // public for template access
  ) {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.checkpointId = id;
      }
    });
  }

  get items(): Item[] {
    return this.itemService.items;
  }

  get tagList(): ChecklistTag[] {
    return Array.from(new Set(this.items.flatMap(i => i.checklistTags)));
  }

  onSelectTag(tag: string) {
    this.checkpointId = tag;
    this.tagInput = tag;
    this.router.navigate(['/checkpoint', tag]);
  }

  onTagInputChange(value: string) {
    this.tagInput = value;
    // Do not set checkpointId here!
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
    if (!this.checkpointId) return;
    const item = this.items.find(i => i.id === id);
    if (item && !item.checklistTags.includes(this.checkpointId)) {
      const updated = { ...item, checklistTags: [...item.checklistTags, this.checkpointId] };
      const err = this.itemService.save(updated);
      if (err) {
        // TODO: Use global error service if needed
        this.popupError = err;
        this.showPopup(null);
        return;
      }
    }
    this.showPopup(item || null);
  }

  onScanQr() {}

  onItemClick(id: string) {
    this.onSubmitId(id);
  }

  get remaining() {
    if (!this.checkpointId) return this.items.slice().sort((a, b) => a.id.localeCompare(b.id));
    return this.items.filter(item => !item.checklistTags.includes(this.checkpointId)).sort((a, b) => a.id.localeCompare(b.id));
  }

  get done() {
    if (!this.checkpointId) return [];
    return this.items.filter(item => item.checklistTags.includes(this.checkpointId)).sort((a, b) => a.id.localeCompare(b.id));
  }

  onUndoDone(item: Item) {
    if (!this.checkpointId) return;
    const idx = item.checklistTags.indexOf(this.checkpointId);
    if (idx >= 0) {
      const updated = { ...item, checklistTags: item.checklistTags.filter(t => t !== this.checkpointId) };
      const err = this.itemService.save(updated);
      if (err) {
        // TODO: Use global error service if needed
        this.popupError = err;
        this.showPopup(null);
        return;
      }
    }
  }

  openEditModal(id: string) {
    const found = this.items.find(item => item.id === id);
    if (found) {
      this.editingItem = { ...found, itemTags: [...found.itemTags], checklistTags: [...found.checklistTags], photos: [...found.photos] };
    }
  }

  onModalSave(edited: Item) {
    const err = this.itemService.save(edited);
    if (err) {
      // TODO: Use global error service if needed
      this.popupError = err;
      this.showPopup(null);
      return;
    }
    this.editingItem = null;
  }

  onModalCancel() {
    this.editingItem = null;
  }

  onPopupEdit() {
    if (this.popupItem) {
      const itemId = this.popupItem.id;
      this.closePopup();
      this.openEditModal(itemId);
    }
  }
}

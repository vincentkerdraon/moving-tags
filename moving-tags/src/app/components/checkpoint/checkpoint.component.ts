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
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';

@Component({
  selector: 'app-checkpoint',
  standalone: true,
  imports: [CommonModule, FormsModule, InputIdComponent, EditItemComponent, CheckpointValidationComponent, ChecklistTagComponent, QrScannerComponent],
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
  showQrScanner = false;

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
    
    // Clear any existing timeout or interval
    clearTimeout(this.popupTimeout);
    if (this.popupInterval) {
      clearInterval(this.popupInterval);
    }
    
    this.popupStart = Date.now();
    const duration = 2500;
        
    this.popupInterval = setInterval(() => {
      if (!this.popupItem || this.popupPreventClose) return;
      const elapsed = Date.now() - this.popupStart;
      this.popupProgress = Math.max(0, 100 - (elapsed / duration) * 100);
      this.cdr.detectChanges();
      
      if (this.popupProgress <= 0) {
        this.popupProgress = 0;
        // Auto-confirm when timer expires
        this.onConfirmItem();
        clearInterval(this.popupInterval);
        this.popupInterval = null;
        this.cdr.detectChanges();
      }
    }, 200); // Not too frequent to avoid performance issues. Else it closes before the progress bar can reach 0
  }

  preventPopupClose() {
    this.popupPreventClose = true;
    clearTimeout(this.popupTimeout);
    if (this.popupInterval) {
      clearInterval(this.popupInterval);
      this.popupInterval = null;
    }
    this.popupProgress = 0; // Set progress to 0 when paused
    this.cdr.detectChanges();
  }

  closePopup() {
    this.popupItem = null;
    this.popupProgress = 100;
    this.popupPreventClose = false;
    clearTimeout(this.popupTimeout);
    if (this.popupInterval) {
      clearInterval(this.popupInterval);
      this.popupInterval = null;
    }
    this.cdr.detectChanges();
  }

  onSubmitId(id: string) {
    console.log('Checkpoint: onSubmitId called with:', id, 'Current checkpointId:', this.checkpointId);
    
    if (!this.checkpointId) {
      //FIXME display error
      console.warn('Checkpoint: No checkpointId set, returning');
      return;
    }
    
    const item = this.items.find(i => i.id === id);
    
    if (!item) {
      console.warn('Checkpoint: Item not found with ID:', id);
      this.popupError = 'Item not found: ' + id;
      //FIXME show error popup
      // Don't call showPopup(null) as it overrides our specific error message
      setTimeout(() => {
        this.popupError = null;
        this.cdr.detectChanges();
      }, 3000); // Show error for 3 seconds
      this.cdr.detectChanges();
      return;
    }
    
    // Only show popup for remaining items
    const hasChecklistTag = item.checklistTags.includes(this.checkpointId);
    console.log('Checkpoint: Item has checkpoint tag:', hasChecklistTag);
    
    if (!hasChecklistTag) {
      this.showPopup(item);
    } else {
      console.log('Checkpoint: Item already has checkpoint tag, not showing popup');
      //FIXME still show something
    }
  }

  onScanQr() {
    this.showQrScanner = true;
  }

  onQrScanResult(result: string) {
    console.log('Checkpoint: QR scan result received:', result, '(',typeof result,')');
    this.showQrScanner = false;
    // Process the scanned result as an item ID
    if (result && result.trim()) {
      const trimmedResult = result.trim();
      this.onSubmitId(trimmedResult);
    } else {
      //FIXME show error
      console.warn('Checkpoint: Empty or invalid QR result, not processing');
    }
  }

  onQrScanClose() {
    this.showQrScanner = false;
  }

  onItemClick(id: string) {
    // Only process clicks for remaining items, not done items
    const item = this.items.find(i => i.id === id);
    if (item && !item.checklistTags.includes(this.checkpointId)) {
      this.onSubmitId(id);
    }
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

  onConfirmItem() {
    if (!this.popupItem || !this.checkpointId) return;
    
    const updated = { ...this.popupItem, checklistTags: [...this.popupItem.checklistTags, this.checkpointId] };
    const err = this.itemService.save(updated);
    if (err) {
      this.popupError = err;
      this.showPopup(null);
      return;
    }
    
    // Close the popup after successful confirmation
    this.closePopup();
  }
}

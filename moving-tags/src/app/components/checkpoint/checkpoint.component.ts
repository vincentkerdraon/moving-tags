import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChecklistTag, Item } from '../../models/data.models';
import { ItemService } from '../../services/item.service';
import { InputIdComponent } from '../input-id/input-id.component';

@Component({
  selector: 'app-checkpoint',
  standalone: true,
  imports: [CommonModule, FormsModule, InputIdComponent],
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

  constructor(private cdr: ChangeDetectorRef, private route: ActivatedRoute, private router: Router, private itemService: ItemService) {
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

  showPopup(item: Item) {
    this.popupItem = item;
    this.popupPreventClose = false;
    this.popupProgress = 100;
    clearTimeout(this.popupTimeout);
    clearInterval(this.popupInterval);
    this.popupStart = Date.now();
    const duration = 2500;
    this.popupInterval = setInterval(() => {
      if (this.popupPreventClose) {
        clearInterval(this.popupInterval);
        return;
      }
      if (this.popupItem) {
        const elapsed = Date.now() - this.popupStart;
        this.popupProgress = Math.max(0, 100 - Math.round((elapsed / duration) * 100));
        this.cdr.detectChanges();
        if (elapsed >= duration) {
          this.popupProgress = 0;
          this.popupItem = null;
          clearInterval(this.popupInterval);
          this.cdr.detectChanges();
        }
      }
    }, 40);
    this.popupTimeout = setTimeout(() => {
      if (!this.popupPreventClose) {
        this.popupItem = null;
        clearInterval(this.popupInterval);
        this.cdr.detectChanges();
      }
    }, duration);
  }

  preventPopupClose() {
    this.popupPreventClose = true;
    clearTimeout(this.popupTimeout);
    clearInterval(this.popupInterval);
    this.cdr.detectChanges();
  }

  closePopup() {
    this.popupItem = null;
    this.popupProgress = 100;
    clearTimeout(this.popupTimeout);
    clearInterval(this.popupInterval);
    this.cdr.detectChanges();
  }

  onSubmitId(id: string) {
    if (!this.selectedTag) return;
    const item = this.items.find(i => i.id === id);
    if (item && !item.checklistTags.includes(this.selectedTag)) {
      item.checklistTags.push(this.selectedTag);
    }
    if (item) this.showPopup(item);
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
      this.cdr.detectChanges();
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChecklistTag, Item } from '../../models/data.models';
import { InputIdComponent } from '../input-id/input-id.component';

@Component({
  selector: 'app-checkpoint',
  standalone: true,
  imports: [CommonModule, FormsModule, InputIdComponent],
  templateUrl: './checkpoint.component.html',
})
export class CheckpointComponent {
  @Input() items: Item[] = [];
  @Input() allTags: ChecklistTag[] = [];
  doneIds: Set<string> = new Set();
  selectedTag: ChecklistTag = '';
  tagInput: string = '';
  tagSelected = false;

  get tagList(): ChecklistTag[] {
    return Array.from(new Set([...this.allTags, ...this.items.flatMap(i => i.checklistTags)]));
  }

  onSelectTag(tag: string) {
    this.selectedTag = tag;
    this.tagInput = tag;
    this.tagSelected = !!tag;
  }

  onTagInputChange(value: string) {
    this.tagInput = value;
    this.selectedTag = value;
    this.tagSelected = false;
  }

  onSubmitId(id: string) {
    if (!this.selectedTag) return;
    const item = this.items.find(i => i.id === id);
    if (item && !item.checklistTags.includes(this.selectedTag)) {
      item.checklistTags.push(this.selectedTag);
    }
  }

  onScanQr() {
    // Placeholder for QR scan logic
  }

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
}

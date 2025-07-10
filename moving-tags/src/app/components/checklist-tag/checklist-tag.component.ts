import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ChecklistTag } from '../../models/data.models';

@Component({
  selector: 'app-checklist-tag',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checklist-tag.component.html'
})
export class ChecklistTagComponent {
  @Input() tag!: ChecklistTag;
  @Input() removable = false;
  @Output() tagClick = new EventEmitter<ChecklistTag>();
  @Output() removeTag = new EventEmitter<ChecklistTag>();

  onTagClick() {
    this.tagClick.emit(this.tag);
  }

  onRemove(event: Event) {
    event.stopPropagation();
    this.removeTag.emit(this.tag);
  }
}

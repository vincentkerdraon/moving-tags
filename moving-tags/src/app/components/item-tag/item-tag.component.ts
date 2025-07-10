import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ItemTag } from '../../models/data.models';

@Component({
  selector: 'app-item-tag',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './item-tag.component.html'
})
export class ItemTagComponent {
  @Input() tag!: ItemTag;
  @Input() removable = false;
  @Output() tagClick = new EventEmitter<ItemTag>();
  @Output() removeTag = new EventEmitter<ItemTag>();

  onTagClick() {
    this.tagClick.emit(this.tag);
  }

  onRemove(event: Event) {
    event.stopPropagation();
    this.removeTag.emit(this.tag);
  }
}

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
  @Output() tagClick = new EventEmitter<ItemTag>();
  @Output() removeTag: EventEmitter<ItemTag> = new EventEmitter<ItemTag>();

  canRemove(): boolean {
    return this.removeTag.observers.length > 0;
  }

  onTagClick() {
    this.tagClick.emit(this.tag);
  }

  onRemove(event: Event) {
    event.stopPropagation();
    this.removeTag.emit(this.tag);
  }
}

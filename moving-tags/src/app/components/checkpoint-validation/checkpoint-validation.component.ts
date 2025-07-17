import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Item } from '../../models/data.models';
import { ImageService } from '../../services/image.service';
import { ItemService } from '../../services/item.service';

@Component({
  selector: 'app-checkpoint-validation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkpoint-validation.component.html'
})
export class CheckpointValidationComponent implements OnChanges {
  @Input() popupItem!: Item;
  @Input() popupProgress!: number;
  @Input() popupPreventClose!: boolean;
  @Output() keep = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  keepClicked = false;

  constructor(public itemService: ItemService,public imageService: ImageService) {}

  ngOnChanges(changes: SimpleChanges) {
    // Reset keepClicked when a new popup item is shown
    if (changes['popupItem'] && changes['popupItem'].currentValue !== changes['popupItem'].previousValue) {
      this.keepClicked = false;
    }
  }

  onKeepClick() {
    this.keepClicked = true;
    this.keep.emit();
  }
}

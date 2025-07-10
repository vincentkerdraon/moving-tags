import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Item } from '../../models/data.models';

@Component({
  selector: 'app-checkpoint-validation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkpoint-validation.component.html'
})
export class CheckpointValidationComponent {
  @Input() popupItem!: Item;
  @Input() popupProgress!: number;
  @Input() popupPreventClose!: boolean;
  @Output() keep = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
}

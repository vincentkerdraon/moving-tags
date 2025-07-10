import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error.component.html'
})
export class ErrorComponent {
  @Input() error: string | null = null;
  @Output() clear = new EventEmitter<void>();
}

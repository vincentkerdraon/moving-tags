import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-input-id',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './input-id.component.html',
})
export class InputIdComponent {
  id = '';
  @Output() submitId = new EventEmitter<string>();
  @Output() scanQr = new EventEmitter<void>();

  onSubmit() {
    if (this.id.trim()) {
      this.submitId.emit(this.id.trim());
    }
  }

  onScanQr() {
    this.scanQr.emit();
  }
}

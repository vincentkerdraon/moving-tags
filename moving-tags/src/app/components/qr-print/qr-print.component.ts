import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QrCodeDisplayComponent } from '../qr-code-display/qr-code-display.component';

@Component({
  selector: 'app-qr-print',
  standalone: true,
  imports: [CommonModule, FormsModule, QrCodeDisplayComponent],
  styleUrls: ['./qr-print.component.scss'],
  templateUrl: './qr-print.component.html',
})
export class QrPrintComponent {
  idsInput = '';
  contact = '';
  idPrefix = '';
  cols = Array(6);

  get parsedIds(): string[] {
    return this.idsInput
      .split(';')
      .map(s => s.trim())
      .filter(s => !!s);
  }

  randomizeIds() {
    // Exclude I, O for clarity
    //Exclude J for spelling prononciation
    const letters = 'ABCDEFGHKLMNPQRSTUVWXYZ'; 
    // Exclude 0, 1 for clarity
    const numbers = '0123456789'; 
    const used = new Set<string>();
    const ids: string[] = [];
    while (ids.length < 30) {
      let id = '';
      if (Math.random() < 0.5) {
        id = letters[Math.floor(Math.random() * letters.length)] + numbers[Math.floor(Math.random() * numbers.length)];
      } else {
        id = numbers[Math.floor(Math.random() * numbers.length)] + letters[Math.floor(Math.random() * letters.length)];
      }
      if (!used.has(id)) {
        used.add(id);
        ids.push(id);
      }
    }
    this.idsInput = ids.join(';');
  }
}

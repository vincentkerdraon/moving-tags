import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-qr-code-display',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  template: `
    <div class="d-flex flex-column align-items-center">
      <qrcode [qrdata]="id" [width]="150" [errorCorrectionLevel]="'M'"></qrcode>
      <div class="text-center small text-muted qr-label">{{ id }}</div>
    </div>
  `,
  styleUrls: ['./qr-code-display.component.scss']
})
export class QrCodeDisplayComponent {
  @Input() id: string = '';
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-qr-code-display',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  template: `
    <div class="d-flex flex-column align-items-center position-relative">
      <div *ngIf="contact" class="text-center small text-muted position-absolute" style="top: -0px; left: 50%; transform: translateX(-50%);width:145px">{{ contact }}</div>
      <qrcode [qrdata]="id" [width]="145" [errorCorrectionLevel]="'M'"></qrcode>
      <div class="text-center  qr-label">
        <span *ngIf="idPrefix" class="text-secondary small text-muted ">{{ idPrefix }}:</span>{{ id }}
      </div>
    </div>
  `,
  styleUrls: ['./qr-code-display.component.scss']
})
export class QrCodeDisplayComponent {
  @Input() id: string = '';
  @Input() contact: string = '';
  @Input() idPrefix: string = '';

  get displayId(): string {
    return this.idPrefix ? `${this.idPrefix}:${this.id}` : this.id;
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-webrtc-qr-code',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  template: `
    <div class="d-flex flex-column align-items-center">
      <qrcode [qrdata]="data" [errorCorrectionLevel]="'L'" ></qrcode>
    </div>
  `
})
export class WebrtcQrCodeComponent {
  @Input() data: string = '';
  @Input() size: number = 256;
}

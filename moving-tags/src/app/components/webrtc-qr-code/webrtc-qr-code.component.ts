import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-webrtc-qr-code',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  template: `
    <div class="d-flex flex-column align-items-center">
      <qrcode 
        [qrdata]="data" 
        [errorCorrectionLevel]="'L'"
        [width]="size"
        [cssClass]="'qr-code-responsive'"
        [elementType]="'canvas'"
      ></qrcode>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 100%;
    }
    ::ng-deep .qr-code-responsive {
      max-width: 100% !important;
      height: auto !important;
    }
    ::ng-deep .qr-code-responsive canvas {
      max-width: 100% !important;
      height: auto !important;
    }
  `]
})
export class WebrtcQrCodeComponent {
  @Input() data: string = '';
  @Input() size: number = 256;
}

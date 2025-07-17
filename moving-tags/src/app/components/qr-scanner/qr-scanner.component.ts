import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, ZXingScannerModule],
  template: `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0, 0, 0, 0.8)">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Scan QR Code</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              (click)="onClose()"
            ></button>
          </div>
          <div class="modal-body text-center">
            <div *ngIf="!cameraReady" class="mb-3">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="text-muted mt-2">Starting camera...</p>
            </div>
            <div class="d-flex justify-content-center mb-3">
              <zxing-scanner
                (scanSuccess)="onScanSuccess($event)"
                (scanError)="onScanError($event)"
                (scanFailure)="onScanFailure($event)"
                (scanComplete)="onScanComplete($event)"
                (camerasFound)="onCamerasFound($event)"
                (camerasNotFound)="onCamerasNotFound()"
                (permissionResponse)="onPermissionResponse($event)"
                [torch]="false"
                [enable]="true"
                [tryHarder]="true"
                [timeBetweenScans]="500"
                style="max-width: 100%; width: 100%;"
                [style.visibility]="cameraReady ? 'visible' : 'hidden'"
              ></zxing-scanner>
            </div>
            <div *ngIf="errorMessage" class="alert alert-warning">
              {{ errorMessage }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="onClose()">
              ❌ Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade show"></div>
  `
})
export class QrScannerComponent {
  @Output() scanResult = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();
  
  errorMessage: string | null = null;
  cameraReady = false;
  
  // Configure allowed barcode formats - focus on QR codes first
  allowedFormats = [
    BarcodeFormat.QR_CODE
  ];

  onScanSuccess(result: string) {
    console.log('QR Scanner: Raw scan result received:', result);
    
    if (result) {
      this.scanResult.emit(result);
      this.onClose();
    } else {
      console.warn('QR Scanner: Empty or null result received');
    }
  }

  onScanError(error: any) {
    console.error('QR Scanner: Scan error occurred:', error, typeof error,JSON.stringify(error, null, 2));
    this.errorMessage = 'Unable to scan QR code. Make sure your camera is working and the QR code is clearly visible.';
  }

  onScanFailure(error: any) {
    // Don't log every scan failure as it's normal when no QR code is in view
    // console.warn('QR Scanner: Scan failure (no QR code detected):', error);
  }

  onScanComplete(result: any) {
    console.log('QR Scanner: Scan complete event:', result);
  }

  onCamerasFound(devices: any[]) {
    console.log('QR Scanner: Cameras found:', devices);
    this.cameraReady = true;
  }

  onCamerasNotFound() {
    console.error('QR Scanner: No cameras found');
    this.errorMessage = 'No cameras found. Please check camera permissions.';
  }

  onPermissionResponse(permission: boolean) {
    console.log('QR Scanner: Camera permission response:', permission);
    if (!permission) {
      this.errorMessage = 'Camera permission denied. Please allow camera access to scan QR codes.';
    } else {
      // If permission is granted, start a fallback timer in case cameras aren't found immediately
      setTimeout(() => {
        if (!this.cameraReady) {
          this.cameraReady = true;
        }
      }, 2000);
    }
  }

  onClose() {
    this.close.emit();
  }
}

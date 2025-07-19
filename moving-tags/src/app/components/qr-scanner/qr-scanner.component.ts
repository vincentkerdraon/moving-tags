import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, ZXingScannerModule],
  template: `
    <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0, 0, 0, 0.8)">
      <div class="modal-dialog modal-dialog-centered">
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
          <div class="modal-body text-center p-2">
            <div *ngIf="loadingCamera" class="mb-3">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="text-muted mt-2">Starting camera...</p>
            </div>
            <div class="scanner-container mb-3">
              <zxing-scanner
                [device]="currentDevice"
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
                class="responsive-scanner"
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
  `,
  styles: [`
    .modal-dialog {
      margin: 15px;
      max-width: calc(100vw - 30px);
    }
    
    .scanner-container {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    
    ::ng-deep .responsive-scanner {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
    }
    
    ::ng-deep .responsive-scanner video {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: 60vh !important;
      object-fit: contain !important;
    }
    
    ::ng-deep .responsive-scanner canvas {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
    }
    
    @media (max-width: 576px) {
      .modal-dialog {
        margin: 10px;
        max-width: calc(100vw - 20px);
      }
      
      .modal-body {
        padding: 10px !important;
      }
    }
  `]
})
export class QrScannerComponent {
  constructor(private cdr: ChangeDetectorRef) { }
  @Output() scanResult = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  errorMessage: string | null = null;
  currentDevice: MediaDeviceInfo | undefined;
  loadingCamera = true;

  ngOnInit() {
    console.log('[QrScannerComponent] ngOnInit');
  }

  // Configure allowed barcode formats - focus on QR codes first
  allowedFormats = [
    BarcodeFormat.QR_CODE
  ];

  onScanSuccess(result: string) {
    console.log('[QrScannerComponent] onScanSuccess - Raw scan result received:', result);
    if (result) {
      console.log('[QrScannerComponent] Emitting scanResult');
      this.scanResult.emit(result);
    } else {
      console.warn('[QrScannerComponent] Empty or null result received');
    }
  }

  onScanError(error: any) {
    console.error('[QrScannerComponent] onScanError - Scan error occurred:', error, typeof error, JSON.stringify(error, null, 2));
    this.errorMessage = 'Unable to scan QR code. Make sure your camera is working and the QR code is clearly visible.';
  }

  onScanFailure(error: any) {
    // Don't log every scan failure as it's normal when no QR code is in view
    // console.warn('[QrScannerComponent] onScanFailure (no QR code detected):', error);
  }

  onScanComplete(result: any) {
    console.log('[QrScannerComponent] onScanComplete - Scan complete event:', result);
  }

  onCamerasFound(devices: MediaDeviceInfo[]) {
    console.log('[QrScannerComponent] onCamerasFound - Cameras found:', devices);
    if (devices && devices.length > 0) {
      this.currentDevice = devices[0];
      console.log('[QrScannerComponent] Selected currentDevice:', this.currentDevice);
    } else {
      console.warn('[QrScannerComponent] No camera devices found in onCamerasFound');
    }
    this.loadingCamera = false;
    this.cdr.detectChanges();
    console.log('[QrScannerComponent] loadingCamera set to false');
  }

  onCamerasNotFound() {
    console.error('[QrScannerComponent] onCamerasNotFound - No cameras found');
    this.errorMessage = 'No cameras found. Please check camera permissions.';
    this.loadingCamera = false;
    this.cdr.detectChanges();
    console.log('[QrScannerComponent] loadingCamera set to false (not found)');
  }

  onPermissionResponse(permission: boolean) {
    console.log('[QrScannerComponent] onPermissionResponse - Camera permission response:', permission);
    if (!permission) {
      this.errorMessage = 'Camera permission denied. Please allow camera access to scan QR codes.';
      console.warn('[QrScannerComponent] Camera permission denied');
    } else {
      // Show scanner immediately on permission granted
      console.log('[QrScannerComponent] cameraReady set to true on permission granted');
    }
  }

  onClose() {
    console.log('[QrScannerComponent] onClose - Closing scanner');
    this.close.emit();
  }
}

import { Injectable } from '@angular/core';
import imageCompression from 'browser-image-compression';
import { Photo, PhotoId } from '../models/data.models';

@Injectable({ providedIn: 'root' })
export class ImageService {
  private _photos: Photo[] = [];
  private static readonly STORAGE_KEY = 'photos';

  constructor() {
    const stored = localStorage.getItem(ImageService.STORAGE_KEY);
    if (stored) {
      try {
        this._photos = JSON.parse(stored);
      } catch {
        this._photos = [];
      }
    }
  }

  /**
   * Add a photo and return a generated photo id.
   */
  addPhoto(data: string): PhotoId {
    const id =  Math.random().toString(36).slice(2) + Date.now().toString(36);
    this._photos.push({ id, data });
    localStorage.setItem(ImageService.STORAGE_KEY, JSON.stringify(this._photos));
    return id;
  }

  /**
   * Get the photo data (base64) for a given photo id.
   */
  getPhotoData(photoId: PhotoId): string | undefined {
    return this._photos.find(p => p.id === photoId)?.data;
  }

  /**
   * Compress, resize, and auto-rotate an image file. Returns a base64 string.
   */
  async processImage(file: File): Promise<string> {
    const options = {
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      maxSizeMB: 0.5,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
      exifOrientation: 1 // auto
    };
    const compressedFile = await imageCompression(file, options);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject('Failed to read image');
      reader.readAsDataURL(compressedFile);
    });
  }
}

import { Injectable } from '@angular/core';
import * as UTIF from 'utif';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private imageDataUrl: string | null = null;

  getImageDataUrl(): string | null {
    return this.imageDataUrl;
  }

  setImageDataUrl(dataUrl: string | null) {
    this.imageDataUrl = dataUrl;
  }

  uploadPhoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'tif' || ext === 'tiff') {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const ifds = UTIF.decode(reader.result as ArrayBuffer);
            UTIF.decodeImage(reader.result as ArrayBuffer, ifds[0]);
            const rgba = UTIF.toRGBA8(ifds[0]);
            const canvas = document.createElement('canvas');
            canvas.width = ifds[0].width;
            canvas.height = ifds[0].height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Canvas context not available');
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            imageData.data.set(rgba);
            ctx.putImageData(imageData, 0, 0);
            const dataUrl = canvas.toDataURL();
            this.setImageDataUrl(dataUrl);
            resolve(dataUrl);
          } catch (e) {
            reject('Erro ao processar TIFF: ' + e);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          this.setImageDataUrl(dataUrl);
          resolve(dataUrl);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    });
  }

  async extractColorMatrices(imageDataUrl: string): Promise<{ r: number[][], g: number[][], b: number[][] }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context not available');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

        const r: number[][] = [];
        const g: number[][] = [];
        const b: number[][] = [];

        for (let y = 0; y < img.height; y++) {
          r[y] = [];
          g[y] = [];
          b[y] = [];
          for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            r[y][x] = imageData[idx];
            g[y][x] = imageData[idx + 1];
            b[y][x] = imageData[idx + 2];
          }
        }
        resolve({ r, g, b });
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }
}
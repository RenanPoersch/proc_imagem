import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private imageDataUrl: string | null = null;

  // Função para upload de foto (lê o arquivo e retorna o DataURL)
  uploadPhoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.imageDataUrl = reader.result as string;
        resolve(this.imageDataUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Função para extrair as matrizes de cores (R, G, B) da imagem
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
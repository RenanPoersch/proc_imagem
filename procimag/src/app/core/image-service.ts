import { Injectable } from '@angular/core';
import * as UTIF from 'utif';
import * as exifr from 'exifr';

export interface ImageMetadata {
  container: {
    mime?: any;
    extension?: any;
    sizeBytes?: any;
    width?: any;
    height?: any;
    bitDepth?: any;
    samplesPerPixel?: any;
    colorSpace?: any;
    compression?: any;
  };
  exif?: Record<string, any> | null;
  iptc?: Record<string, any> | null;
  xmp?: Record<string, any> | null;
  icc?: Record<string, any> | null;
  tiff?: Record<string, any> | null;
  computed?: {
    hasAlpha?: boolean;
    mean?: { r: any; g: any; b: any; a?: any };
    histogram?: { r: any; g: any; b: any; a?: any };
  };
}

type SniffInfo = {
  width?: number;
  height?: number;
  bitDepth?: number;
  samplesPerPixel?: number;
  colorSpace?: string;
  compression?: string;
  hasAlpha?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ImageService {
  private imageDataUrl: string | null = null;
  private secondaryImageDataUrl: any = null;
  private editedImageDataUrl: string | null = null;
  private metadata: ImageMetadata | null = null;

  private rMatrix: number[][] = [];
  private gMatrix: number[][] = [];
  private bMatrix: number[][] = [];
  
  getImageDataUrl(): string | null { return this.imageDataUrl; }
  getSecondaryImageDataUrl(): string | null { return this.secondaryImageDataUrl; }
  getEditedImageDataUrl(): string | null { return this.editedImageDataUrl; }
  getMetadata(): ImageMetadata | null { return this.metadata; }
  getRMatrix(): number[][] { return this.rMatrix; }
  getGMatrix(): number[][] { return this.gMatrix; }
  getBMatrix(): number[][] { return this.bMatrix; }
  
  setImageDataUrl(dataUrl: string | null) { this.imageDataUrl = dataUrl; }
  setSecondaryImageDataUrl(dataUrl: string | null) { this.secondaryImageDataUrl = dataUrl; }
  setEditedImageDataUrl(dataUrl: string | null) { this.editedImageDataUrl = dataUrl; }

  get hasProcessableImage(): boolean {
    return !!this.imageDataUrl;
  }

  get hasProcessableSecImage(): boolean {
    return !!this.secondaryImageDataUrl;
  }

  uploadPhoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'tif' || ext === 'tiff') {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const ifds = UTIF.decode(reader.result as ArrayBuffer);
            UTIF.decodeImage(reader.result as ArrayBuffer, ifds[0]);
            const rgba = UTIF.toRGBA8(ifds[0]);
            const canvas = document.createElement('canvas');
            canvas.width = ifds[0].width; canvas.height = ifds[0].height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Canvas context not available');
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            imageData.data.set(rgba);
            ctx.putImageData(imageData, 0, 0);
            const dataUrl = canvas.toDataURL();
            this.setImageDataUrl(dataUrl);
            await this.extractAllMetadata(file); // já popula metadata
            resolve(dataUrl);
          } catch (e) {
            reject('Erro ao processar TIFF: ' + e);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          this.setImageDataUrl(dataUrl);
          await this.extractAllMetadata(file);
          resolve(dataUrl);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    });
  }

  async extractAllMetadata(file: File): Promise<ImageMetadata> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const base: ImageMetadata = {
      container: { mime: file.type || undefined, extension: ext, sizeBytes: file.size },
      exif: null, iptc: null, xmp: null, icc: null, tiff: null, computed: {}
    };

    const isTIFF = ext === 'tif' || ext === 'tiff';

    if (isTIFF) {
      // --- TIFF via UTIF ---
      const buf = await file.arrayBuffer();
      const ifds = UTIF.decode(buf);
      UTIF.decodeImage(buf, ifds[0]);
      const ifd = ifds[0];

      base.container.width = ifd.width;
      base.container.height = ifd.height;
      base.container.samplesPerPixel = ifd['samplesPerPixel'];
      base.container.bitDepth = ifd['bitsPerSample'];
      base.container.colorSpace = ifd['photometricInterpretation'];
      base.container.compression = ifd['compression'];

      base.tiff = this.pickTiffTags(ifd);

      const rgba = UTIF.toRGBA8(ifd);
      const canvas = document.createElement('canvas');
      canvas.width = ifd.width; canvas.height = ifd.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
        this.imageDataUrl = canvas.toDataURL();
        base.computed = this.computeDerivedFromCanvas(ctx, canvas.width, canvas.height);
      }
    } else {
      // --- EXIF/IPTC/XMP (opcional) ---
      try {
        const meta = await exifr.parse(file, { iptc: true, xmp: true, icc: true, exif: true });
        if (meta) {
          base.exif = meta || null;
          base.iptc = (meta as any).iptc || null;
          base.xmp  = (meta as any).xmp  || null;
          base.icc  = (meta as any).icc  || null;
          base.container.width  = (meta as any).ImageWidth || (meta as any).ExifImageWidth || base.container.width;
          base.container.height = (meta as any).ImageHeight || (meta as any).ExifImageHeight || base.container.height;
          base.container.colorSpace = (meta as any).ColorSpace || base.container.colorSpace;
        }
      } catch {}

      // --- NOVO: ler direto do header (preenche mesmo sem EXIF) ---
      const sniff = await this.sniffContainer(file);
      if (sniff) {
        base.container.width           ??= sniff.width;
        base.container.height          ??= sniff.height;
        base.container.bitDepth        ??= sniff.bitDepth;
        base.container.samplesPerPixel ??= sniff.samplesPerPixel;
        base.container.colorSpace      ??= sniff.colorSpace;
        base.container.compression     ??= sniff.compression;
        if (base.computed && base.computed.hasAlpha === undefined && sniff.hasAlpha !== undefined) {
          base.computed.hasAlpha = sniff.hasAlpha;
        }
      }

      // Se ainda faltar width/height, completa via ImageBitmap/IMG
      if (!base.container.width || !base.container.height) {
        try {
          const bmp = await createImageBitmap(file);
          base.container.width = bmp.width; base.container.height = bmp.height;
        } catch {
          Object.assign(base.container, await this.readSizeWithImageTag(file));
        }
      }

      // DataURL + derivados
      const dataUrl = await this.fileToDataURL(file);
      this.imageDataUrl = dataUrl;
      const { ctx, width, height } = await this.canvasFromDataURL(dataUrl);
      if (ctx) base.computed = this.computeDerivedFromCanvas(ctx, width, height);
    }

    this.metadata = base;
    return base;
  }

  async extractColorMatrices(imageDataUrl: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('Canvas context not available'); return; }

        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;

        const r: number[][] = [];
        const g: number[][] = [];
        const b: number[][] = [];

        for (let y = 0; y < img.height; y++) {
          r[y] = []; g[y] = []; b[y] = [];
          for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            r[y][x] = data[idx];
            g[y][x] = data[idx + 1];
            b[y][x] = data[idx + 2];
          }
        }

        this.rMatrix = r;
        this.gMatrix = g;
        this.bMatrix = b;

        resolve();
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }

  async uploadSecondaryPhoto(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    // suporta TIFF como no principal, mas sem extrair metadata
    if (ext === 'tif' || ext === 'tiff') {
      const buf = await file.arrayBuffer();
      const ifds = UTIF.decode(buf);
      UTIF.decodeImage(buf, ifds[0]);
      const rgba = UTIF.toRGBA8(ifds[0]);

      const canvas = document.createElement('canvas');
      canvas.width = ifds[0].width; canvas.height = ifds[0].height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const imageData = ctx.createImageData(canvas.width, canvas.height);
      imageData.data.set(rgba);
      ctx.putImageData(imageData, 0, 0);

      const dataUrl = canvas.toDataURL();
      this.setSecondaryImageDataUrl(dataUrl);
      return dataUrl;
    }

    // demais formatos: ler como DataURL direto
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    this.setSecondaryImageDataUrl(dataUrl);
    return dataUrl;
  }

  private async readHead(file: File, n = 8192): Promise<Uint8Array> {
    const buf = await file.slice(0, n).arrayBuffer();
    return new Uint8Array(buf);
  }

  private async sniffContainer(file: File): Promise<SniffInfo | null> {
    const head = await this.readHead(file);
    const mime = file.type;

    if (mime?.includes('png') || head[0] === 0x89) {
      return this.parsePNG(head);
    }
    if (mime?.includes('jpeg') || mime?.includes('jpg') || (head[0] === 0xFF && head[1] === 0xD8)) {
      return this.parseJPEG(head);
    }
    if (mime?.includes('webp')) {
      return this.parseWebP(head);
    }
    return null;
  }

  private async fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  private async readSizeWithImageTag(file: File): Promise<Pick<ImageMetadata['container'], 'width' | 'height'>> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ width: img.width, height: img.height }); URL.revokeObjectURL(url); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }
  
  private async canvasFromDataURL(dataUrl: string): Promise<{
    ctx: CanvasRenderingContext2D | null; width: number; height: number;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context not available');
        ctx.drawImage(img, 0, 0);
        resolve({ ctx, width: canvas.width, height: canvas.height });
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  private parsePNG(head: Uint8Array): SniffInfo | null {
    // Assinatura PNG
    const isPNG = head.length >= 33 &&
      head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47 &&
      head[4] === 0x0D && head[5] === 0x0A && head[6] === 0x1A && head[7] === 0x0A;
    if (!isPNG) return null;

    // IHDR começa em 16: width(4), height(4), bitDepth(1), colorType(1) ...
    const width  = (head[16] << 24) | (head[17] << 16) | (head[18] << 8) | head[19];
    const height = (head[20] << 24) | (head[21] << 16) | (head[22] << 8) | head[23];
    const bitDepth = head[24];
    const colorType = head[25]; // 0 Gray, 2 RGB, 3 Indexed, 4 GrayA, 6 RGBA

    const samplesMap: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const csMap: Record<number, string> = {
      0: 'Grayscale', 2: 'RGB', 3: 'Indexed', 4: 'Grayscale+Alpha', 6: 'RGBA'
    };

    return {
      width, height,
      bitDepth,
      samplesPerPixel: samplesMap[colorType],
      colorSpace: csMap[colorType],
      compression: 'PNG (DEFLATE)',
      hasAlpha: colorType === 4 || colorType === 6
    };
  }

  private parseJPEG(head: Uint8Array): SniffInfo | null {
    // Assinatura JPEG
    if (!(head.length >= 3 && head[0] === 0xFF && head[1] === 0xD8)) return null;

    let i = 2;
    while (i + 3 < head.length) {
      if (head[i] !== 0xFF) { i++; continue; }
      const marker = head[i + 1];
      i += 2;

      // Sem payload
      if (marker === 0xD9 /*EOI*/ || marker === 0xDA /*SOS*/) break;
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;

      if (i + 1 >= head.length) break;
      const len = (head[i] << 8) | head[i + 1];
      if (len < 2 || i + len > head.length) break;

      // SOF0..SOF3 (baseline/progressivo/etc.)
      if (marker >= 0xC0 && marker <= 0xC3 && len >= 9) {
        const precision = head[i + 2];              // bits/sample (geralmente 8)
        const height    = (head[i + 3] << 8) | head[i + 4];
        const width     = (head[i + 5] << 8) | head[i + 6];
        const comps     = head[i + 7];              // 1=Gray, 3=YCbCr, 4=CMYK
        const cs = comps === 1 ? 'Grayscale' : comps === 3 ? 'YCbCr' : comps === 4 ? 'CMYK' : `${comps} comps`;
        return {
          width, height,
          bitDepth: precision,
          samplesPerPixel: comps,
          colorSpace: cs,
          compression: 'JPEG',
          hasAlpha: false
        };
      }
      i += len;
    }
    // fallback
    return { bitDepth: 8, samplesPerPixel: 3, colorSpace: 'YCbCr', compression: 'JPEG', hasAlpha: false };
  }

  private parseWebP(head: Uint8Array): SniffInfo | null {
    // RIFF....WEBP
    const isRIFF = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
    const isWEBP = head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    if (!isRIFF || !isWEBP) return null;

    // Heurística simples de alpha: VP8X com bit de alpha, ou VP8L com alpha implícito
    const tag = String.fromCharCode(head[12], head[13], head[14], head[15]); // 'VP8 ', 'VP8L', 'VP8X'
    let hasAlpha = false;
    if (tag === 'VP8X') {
      const flags = head[20];
      hasAlpha = (flags & 0b00010000) !== 0; // bit 4 = alpha
    } else if (tag === 'VP8L') {
      hasAlpha = true; // lossless WebP suporta alpha
    }
    return { bitDepth: 8, samplesPerPixel: hasAlpha ? 4 : 3, colorSpace: 'RGB', compression: 'WebP', hasAlpha };
  }

  private pickTiffTags(ifd: any): Record<string, any> {
    const omit = new Set(['data','tiffOffset','t34665','thumbnail','stripOffsets','stripByteCounts']);
    const out: Record<string, any> = {};
    for (const k of Object.keys(ifd)) {
      if (omit.has(k)) continue;
      const v = (ifd as any)[k];
      if (typeof v === 'object' && v?.length > 64) continue;
      out[k] = v;
    }
    return out;
  }

  private computeDerivedFromCanvas(
    ctx: CanvasRenderingContext2D, width: number, height: number
  ): ImageMetadata['computed'] {
    const data = ctx.getImageData(0, 0, width, height).data;
    const histR = new Array(256).fill(0);
    const histG = new Array(256).fill(0);
    const histB = new Array(256).fill(0);
    const histA = new Array(256).fill(0);
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      histR[r]++; histG[g]++; histB[b]++; histA[a]++;
      sumR += r; sumG += g; sumB += b; sumA += a;
    }
    const n = (data.length / 4) || 1;
    const hasAlpha = histA[255] !== n; // heurística simples

    return {
      hasAlpha,
      mean: { r: sumR / n, g: sumG / n, b: sumB / n, a: sumA / n },
      histogram: { r: histR, g: histG, b: histB, a: histA }
    };
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src; 
    });
  }

  private makeCanvas(img: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    return { canvas, ctx };
  }

  private limit8(x: number) { 
    return x < 0 ? 0 : x > 255 ? 255 : x | 0; 
  }

/**
 * Abre uma imagem (dataURL ou URL), cria canvas+ctx, entrega ImageData para edição
 * e salva o resultado retornado pelo editor.
 *
 * editor: função que RECEBE imageData e RETORNA (sincrono/assíncrono) o MESMO imageData
 * já modificado (ou um novo), que será aplicado no canvas.
 * Retorna o dataURL final.
 */
private async runOnImageData(
  editor: (imageData: ImageData, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void | ImageData | Promise<void | ImageData>
): Promise<string | null> {

  const src = this.imageDataUrl ?? null;
  if (!src) { 
    console.warn('[runOnImageData] Sem imagem para processar.'); 
    return null; 
  }

  const img = await this.loadImage(src);
  const { canvas, ctx } = this.makeCanvas(img);
  ctx.drawImage(img, 0, 0);

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const maybeNew = await editor(imageData, ctx, canvas);

  if (maybeNew instanceof ImageData) {
    imageData = maybeNew;
  }

  ctx.putImageData(imageData, 0, 0);
  const out = canvas.toDataURL();
  this.setEditedImageDataUrl(out);
  return out;
}


 // ╔══════════════════╗
 // ║   ARITMÉTICA     ║
 // ╚══════════════════╝


  async adjustBrightness(brightness: number): Promise<void> {
    await this.runOnImageData((imageData) => {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = this.limit8(d[i]     + brightness);
        d[i + 1] = this.limit8(d[i + 1] + brightness);
        d[i + 2] = this.limit8(d[i + 2] + brightness);
      }
    });
  }

  async addImage(percent: number, operation?: string): Promise<void> {
    if (!this.secondaryImageDataUrl) {
      console.warn('[addImage] Nenhuma imagem secundária carregada.');
      return;
    }

    const k = percent / 100;

    await this.runOnImageData(async (imageData, ctx) => {

      const secImg = await this.loadImage(this.secondaryImageDataUrl);
      const W = ctx.canvas.width, H = ctx.canvas.height;

      const secCanvas = document.createElement('canvas');
      secCanvas.width = W;
      secCanvas.height = H;
      const secCtx = secCanvas.getContext('2d');
      if (!secCtx) throw new Error('Canvas context not available');

      secCtx.drawImage(secImg, 0, 0, W, H);

      const secData = secCtx.getImageData(0, 0, W, H).data;
      const d = imageData.data;

      if (operation === 'subtract') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     - k * secData[i]);
          d[i + 1] = this.limit8(d[i + 1] - k * secData[i + 1]);
          d[i + 2] = this.limit8(d[i + 2] - k * secData[i + 2]);
        }
      } else {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     + k * secData[i]);
          d[i + 1] = this.limit8(d[i + 1] + k * secData[i + 1]);
          d[i + 2] = this.limit8(d[i + 2] + k * secData[i + 2]);
        }
      }

      return imageData;
    });
  }

  async adjustContrast(factor: number): Promise<void> {
    await this.runOnImageData((imageData) => {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = this.limit8((d[i]     - 128) * factor + 128);
        d[i + 1] = this.limit8((d[i + 1] - 128) * factor + 128);
        d[i + 2] = this.limit8((d[i + 2] - 128) * factor + 128);
      }
    });
  }

}
import { Injectable } from '@angular/core';
import * as UTIF from 'utif';
import * as exifr from 'exifr';
import { ConversorService } from './conversor.service';

type RGBKey = 'r' | 'g' | 'b';

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
  constructor(private conversorService: ConversorService) {}

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

  srgbToLinear(c: number): number {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  linearToSrgb(c: number): number {
    return c <= 0.0031308
      ? Math.round(255 * (12.92 * c))
      : Math.round(255 * (1.055 * Math.pow(c, 1 / 2.4) - 0.055));
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

  private canvasFromDataURL(dataUrl: string): Promise<{
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
 async runOnImageData(
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


  adjustBrightness(brightness: number, op: string | null) {
    this.runOnImageData((imageData) => {
      const d = imageData.data;
    if(op) {
       for (let i = 0; i < d.length; i += 4) {
        d[i]     = this.limit8(d[i]     * brightness);
        d[i + 1] = this.limit8(d[i + 1] * brightness);
        d[i + 2] = this.limit8(d[i + 2] * brightness);
      }
    } else {
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = this.limit8(d[i]     + brightness);
        d[i + 1] = this.limit8(d[i + 1] + brightness);
        d[i + 2] = this.limit8(d[i + 2] + brightness);
      }
    }
    });
  }

  addImage(percent: { a: number; b: number }, op?: string) {
    if (!this.secondaryImageDataUrl) {
      console.warn('[addImage] Nenhuma imagem secundária carregada.');
      return;
    }
    const k  = percent.a / 100;
    const k2 = percent.b / 100;

    this.runOnImageData(async (imageData, ctx) => {
      const secImg = await this.loadImage(this.secondaryImageDataUrl);
      const W = ctx.canvas.width, H = ctx.canvas.height;

      const secCanvas = document.createElement('canvas');
      secCanvas.width = W; secCanvas.height = H;

      const secCtx = secCanvas.getContext('2d');
      if (!secCtx) throw new Error('Canvas context not available');

      secCtx.drawImage(secImg, 0, 0, W, H);
      const secData = secCtx.getImageData(0, 0, W, H).data;
      const d = imageData.data;

      if (op === 'subtract') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     * k - k2 * secData[i]);
          d[i + 1] = this.limit8(d[i + 1] * k - k2 * secData[i + 1]);
          d[i + 2] = this.limit8(d[i + 2] * k - k2 * secData[i + 2]);
        }
      } else if (op === 'modulo') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(Math.abs(d[i]     * k - k2 * secData[i]));
          d[i + 1] = this.limit8(Math.abs(d[i + 1] * k - k2 * secData[i + 1]));
          d[i + 2] = this.limit8(Math.abs(d[i + 2] * k - k2 * secData[i + 2]));
        }
      } else if(op === 'add') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     * k + k2 * secData[i]);
          d[i + 1] = this.limit8(d[i + 1] * k + k2 * secData[i + 1]);
          d[i + 2] = this.limit8(d[i + 2] * k + k2 * secData[i + 2]);
        }
      } else if(op === 'media') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     * k + k2 * secData[i]) / 2 ;
          d[i + 1] = this.limit8(d[i + 1] * k + k2 * secData[i + 1]) / 2;
          d[i + 2] = this.limit8(d[i + 2] * k + k2 * secData[i + 2]) / 2;
        }
      }
      return imageData;
    });
  }

  adjustContrast(factor: number) {
    this.runOnImageData((imageData) => {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = this.limit8((d[i]     - 128) * factor + 128);
        d[i + 1] = this.limit8((d[i + 1] - 128) * factor + 128);
        d[i + 2] = this.limit8((d[i + 2] - 128) * factor + 128);
      }
    });
  }


 // ╔══════════════════╗
 // ║   GEOMETRICA     ║
 // ╚══════════════════╝


  async flipImage(direction: 'hor' | 'ver') {

    this.runOnImageData((imageData, ctx, canvas) => {
      const width = canvas.width;
      const height = canvas.height;
      const src = imageData.data;

      const array = new Uint8ClampedArray(src.length);

      for (let x = 0; x < height; x++) {
        for (let j = 0; j < width; j++) {
          const srcIdx = (x * width + j) * 4;

          let destinyX = direction === 'hor' ? width - j - 1 : j;
          let destinyY = direction === 'ver' ? height - x - 1 : x;

          const destIdx = (destinyY * width + destinyX) * 4;

          array[destIdx]     = src[srcIdx];
          array[destIdx + 1] = src[srcIdx + 1];
          array[destIdx + 2] = src[srcIdx + 2];
          array[destIdx + 3] = src[srcIdx + 3];
        }
      }

      return new ImageData(array, width, height);

    });
  }

  
 // ╔══════════════════╗
 // ║       LOGIC      ║
 // ╚══════════════════╝


  addGate(op: 'and' | 'not' | 'or' | 'xor') {
    this.runOnImageData(async (imageData, ctx) => {

      if (op === 'not') {
        this.runOnImageData((imageData) => {
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            d[i]     = this.limit8(255 - d[i]);
            d[i + 1] = this.limit8(255 - d[i + 1]);
            d[i + 2] = this.limit8(255 - d[i + 2]);
          }
          return imageData;
        });
        return;
      }  

      const secImg = await this.loadImage(this.secondaryImageDataUrl);
      const W = ctx.canvas.width, H = ctx.canvas.height;

      const secCanvas = document.createElement('canvas');
      secCanvas.width = W; secCanvas.height = H;

      const secCtx = secCanvas.getContext('2d');
      if (!secCtx) throw new Error('Canvas context not available');

      secCtx.drawImage(secImg, 0, 0, W, H);
      const secData = secCtx.getImageData(0, 0, W, H).data;
      const d = imageData.data;

      if (op === 'and') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     & secData[i]);
          d[i + 1] = this.limit8(d[i + 1] & secData[i + 1]);
          d[i + 2] = this.limit8(d[i + 2] & secData[i + 2]);
        }
      } else if(op === 'or') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     | secData[i]);
          d[i + 1] = this.limit8(d[i + 1] | secData[i + 1]);
          d[i + 2] = this.limit8(d[i + 2] | secData[i + 2]);
        }
      } else if(op === 'xor') {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     = this.limit8(d[i]     ^ secData[i]);
          d[i + 1] = this.limit8(d[i + 1] ^ secData[i + 1]);
          d[i + 2] = this.limit8(d[i + 2] ^ secData[i + 2]);
        }
      }
      return imageData;
    });
  }

  
 // ╔══════════════════╗
 // ║      COLORS      ║
 // ╚══════════════════╝


  toGrayscaleLinear(wr: number, wg: number, wb: number) {

    this.runOnImageData((imageData) => {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {

        const rLin = this.srgbToLinear(d[i]);
        const gLin = this.srgbToLinear(d[i + 1]);
        const bLin = this.srgbToLinear(d[i + 2]);

        const yLin = wr * rLin + wg * gLin + wb * bLin;

        const y = this.linearToSrgb(yLin);
        d[i] = d[i + 1] = d[i + 2] = y;

      }
       return imageData;
    });
  }

  colorGrade(rGain: number, gGain: number, bGain: number, tolR: number, tolG: number, tolB: number) {
    this.runOnImageData((img) => {
      let out = img;
      out = this.enhanceRGBKeyPerceptual(
        out, 'r',
        this.satFactorFromGain(rGain),
        this.clampTolDeg(tolR) 
      );
      out = this.enhanceRGBKeyPerceptual(
        out, 'g',
        this.satFactorFromGain(gGain),
        this.clampTolDeg(tolG)
      );
      out = this.enhanceRGBKeyPerceptual(
        out, 'b',
        this.satFactorFromGain(bGain),
        this.clampTolDeg(tolB)
      );
      return out;
    })
  }

  private satFactorFromGain(gain: number) {
    return 1 + gain / 255;
  }

  private enhanceRGBKeyPerceptual(
    imageData: ImageData,
    RGBKey: RGBKey,
    satFactor: number,
    toleranceDeg: number
  ): ImageData {
    const d = imageData.data;
    const targetH = this.hueForRGBKey(RGBKey);
    
    if (toleranceDeg === 0) {
      return imageData;
    };

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      let [h, s, l] = this.conversorService.rgbToHsl(r, g, b);

      const dist = this.hueDist(h, targetH);
      const w = Math.max(0, 1 - dist / toleranceDeg);

      if (w > 0) {
        const sOut = s * (1 + (satFactor - 1) * w);
        const [nr, ng, nb] = this.conversorService.hslToRgb(h, Math.min(1, Math.max(0, sOut)), l);
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      }
    }
    return imageData;
  }

  private clampTolDeg(deg: number) {
      return Math.max(0, Math.min(180, Math.round(deg)));
    }

  private hueDist(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  private hueForRGBKey(ch: RGBKey): number {
    return ch === 'r' ? 0 : ch === 'g' ? 120 : 240;
  }

  imageTreshold(th: number) {
    this.runOnImageData((imageData) => {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const med = (d[i] + d[i+1] + d[i+2]) / 3;
        const val = med >= th ? 255 : 0;
        if (med >= th ) {
          d[i]     = val;
          d[i + 1] = val;
          d[i + 2] = val;
        } else {
          d[i]     = val;
          d[i + 1] = val;
          d[i + 2] = val;
        }
      }
      return imageData;
    });
  }

  imageNegative() {
    this.runOnImageData((imageData) => {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      return imageData;
    });
  }


  imageTresholdAdaptative(th: number, win: number, C: number) {
    this.runOnImageData((imageData) => {

    const width = imageData.width;
    const height = imageData.height;
    const d = imageData.data;
    const radius = (win - 1) >> 1;

    const gray = new Uint8ClampedArray(width*height);
    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 4) {
        gray[y*width + x] = (d[i] + d[i+1] + d[i+2]) / 3;
      }
    }

    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 4) {

        let sum = 0;
        let count = 0;

        for (let j = -radius; j <= radius; j++) {
          const yy = y + j;

          if (yy < 0 || yy >= height) {
            continue
          };

          for (let i2 = -radius; i2 <= radius; i2++) {
            const xx = x + i2;

            if (xx < 0 || xx >= width) {
              continue
            };

            sum += gray[yy*width + xx];
            count++;
          }
        }

        const mean = sum / count;
        const thLocal = mean - C;
        const val = gray[y*width + x] >= thLocal ? 255 : 0;

        d[i]     = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
    }
    return imageData;
    });
  }

  equalizeHistogram() {

  this.runOnImageData((imageData) => {
    const d = imageData.data;
    const N = d.length / 4;

    // 1) Extrai Y e guarda U/V (derivados do RGB)
    const Y = new Uint8Array(N);
    const U = new Float32Array(N);
    const V = new Float32Array(N);

    for (let i = 0, k = 0; i < d.length; i += 4, k++) {
      const R = d[i], G = d[i+1], B = d[i+2];

      // BT.601 (luma aproximada 8-bit)
      const y  = 0.299  * R + 0.587  * G + 0.114  * B;
      const u  = 128 + (-0.168736 * R - 0.331264 * G + 0.5 * B);
      const v  = 128 + ( 0.5      * R - 0.418688 * G - 0.081312 * B);

      Y[k] = y < 0 ? 0 : y > 255 ? 255 : y | 0;
      U[k] = u;
      V[k] = v;
    }

    // 2) Histograma de Y
    const hist = new Uint32Array(256);
    for (let k = 0; k < N; k++) hist[Y[k]]++;

    // 3) CDF normalizada
    const cdf = new Float64Array(256);
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      cdf[i] = acc / N;
    }

    // Otimização: ignora níveis não usados no início (para evitar "preto" esmagado)
    // (opcional; pode comentar se não quiser)
    let cdfMin = 1;
    for (let i = 0; i < 256; i++) {
      if (cdf[i] > 0) { cdfMin = cdf[i]; break; }
    }

    // 4) Mapeamento Y -> Y' (usa CDF esticada)
    const map = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const v = (cdf[i] - cdfMin) / (1 - cdfMin);
      const yEq = Math.round(Math.max(0, Math.min(1, v)) * 255);
      map[i] = yEq;
    }

    // 5) Aplica mapeamento e reconverte YUV -> RGB
    for (let i = 0, k = 0; i < d.length; i += 4, k++) {
      const yEq = map[Y[k]];
      const u = U[k] - 128;
      const v = V[k] - 128;

      // BT.601 inversa
      let R = yEq + 1.402 * v;
      let G = yEq - 0.344136 * u - 0.714136 * v;
      let B = yEq + 1.772 * u;

      // clamp
      R = R < 0 ? 0 : R > 255 ? 255 : R;
      G = G < 0 ? 0 : G > 255 ? 255 : G;
      B = B < 0 ? 0 : B > 255 ? 255 : B;

      d[i]   = R | 0;
      d[i+1] = G | 0;
      d[i+2] = B | 0;
    }

    return imageData;
  });
}

equalizeHistogra2m() {
  this.runOnImageData((imageData) => {
    const d = imageData.data;
    const gray = new Uint8ClampedArray(d.length / 4);

    // 1) Converte para escala de cinza
    for (let i = 0, k = 0; i < d.length; i += 4, k++) {
      gray[k] = (d[i] + d[i+1] + d[i+2]) / 3;
    }

    // 2) Histograma
    const hist = new Array(256).fill(0);
    gray.forEach(v => hist[v]++);

    // 3) CDF
    const total = gray.length;
    const cdf = new Array(256).fill(0);
    cdf[0] = hist[0] / total;
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i-1] + hist[i] / total;
    }

    // 4) Mapeamento
    const map = cdf.map(v => Math.round(v * 255));

    // 5) Aplica
    for (let i = 0, k = 0; i < d.length; i += 4, k++) {
      const v = map[gray[k]];
      d[i] = d[i+1] = d[i+2] = v; // aplica mesmo valor nos 3 canais
    }

    return imageData;
  });
}


// ╔══════════════════╗
// ║     ESPACIAL     ║
// ╚══════════════════╝


  applyLocalFilter(kind: 'min' | 'max' | 'mean', size: number = 3) {

    const radius = Math.floor(size / 2);

    this.runOnImageData((imageData) => {
    const { width, height, data: array } = imageData;
    const src = new Uint8ClampedArray(array);

    const clamp = (v: number, lo: number, hi: number) => {
      return v < lo ? lo : v > hi ? hi : v
    };

    const idx = (x: number, y: number) => {
      return (y * width + x) * 4;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {

        let redSum = 0, greenSum = 0, blueSum = 0;
        let redMin = 255, greenMin = 255, blueMin = 255;
        let redMax = 0, greenMax = 0, blueMax = 0;

        for (let offsetY = -radius; offsetY <= radius; offsetY++) {
        const neighborY = clamp(y + offsetY, 0, height - 1);

        for (let offsetX = -radius; offsetX <= radius; offsetX++) {
          const neighborX = clamp(x + offsetX, 0, width - 1);
          const neighborIndex = idx(neighborX, neighborY);

          const neighborRed   = src[neighborIndex];
          const neighborGreen = src[neighborIndex + 1];
          const neighborBlue  = src[neighborIndex + 2];

          // mean
          redSum   += neighborRed;
          greenSum += neighborGreen;
          blueSum  += neighborBlue;

          // min
          if (neighborRed   < redMin)   redMin   = neighborRed;
          if (neighborGreen < greenMin) greenMin = neighborGreen;
          if (neighborBlue  < blueMin)  blueMin  = neighborBlue;

          // max
          if (neighborRed   > redMax)   redMax   = neighborRed;
          if (neighborGreen > greenMax) greenMax = neighborGreen;
          if (neighborBlue  > blueMax)  blueMax  = neighborBlue;
        }
      }

        const d = idx(x, y);

        if (kind === 'mean') {
          const count = size * size;
          array[d] = Math.round(redSum / count);
          array[d + 1] = Math.round(greenSum / count);
          array[d + 2] = Math.round(blueSum / count);

        } else if (kind === 'min') {
            array[d] = redMin;
            array[d + 1] = greenMin;
            array[d + 2] = blueMin;

        } else { // 'max'
            array[d] = redMax;
            array[d + 1] = greenMax;
            array[d + 2] = blueMax;
        }
      }
    }
    return imageData;
    });
  }

  applyMedianFilter(size: number = 3) {

    const radius = Math.floor(size / 2);

    this.runOnImageData((imageData) => {
      const { width, height, data: array } = imageData;
      const src = new Uint8ClampedArray(array);

      const clamp = (v: number, lo: number, hi: number) => {
        return v < lo ? lo : v > hi ? hi : v
      };

      const idx = (x: number, y: number) => {
        return (y * width + x) * 4;
      }

      const rVals: number[] = [];
      const gVals: number[] = [];
      const bVals: number[] = [];

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          rVals.length = 0; gVals.length = 0; bVals.length = 0;

          for (let offsetY = -radius; offsetY <= radius; offsetY++) {
            const neighborY = clamp(y + offsetY, 0, height - 1);
            for (let offsetX = -radius; offsetX <= radius; offsetX++) {
              const neighborX = clamp(x + offsetX, 0, width - 1);
              const neighborIndex = idx(neighborX, neighborY);

              rVals.push(src[neighborIndex]);
              gVals.push(src[neighborIndex + 1]);
              bVals.push(src[neighborIndex + 2]);
            }
          }

          const d = idx(x, y);

          array[d] = this.medianOf(rVals);
          array[d + 1] = this.medianOf(gVals);
          array[d + 2] = this.medianOf(bVals);
        }
      }

      return imageData;
    });
  }

  medianOf(array: number[]) {
    const length = array.length;
    if (length === 0) {
      return 0;
    }
    array.sort((a, b) => a - b);
    const mid = Math.floor(length / 2);
    if (length % 2) {
      return array[mid];
    }
    return Math.round((array[mid - 1] + array[mid]) / 2);
  }

  applyOrderFilter(windowSize: number = 3, k: number) {

    const radius = Math.floor(windowSize / 2);

    this.runOnImageData((imageData) => {
    const { width: imageWidth, height: imageHeight, data: pixels } = imageData;
    const sourcePixels = new Uint8ClampedArray(pixels); 

    const clamp = (v: number, lo: number, hi: number) => {
      return v < lo ? lo : v > hi ? hi : v
    };

    const idx = (x: number, y: number) => {
      return (y * imageWidth + x) * 4;
    }

    const redValues: number[] = [];
    const greenValues: number[] = [];
    const blueValues: number[] = [];

    for (let pixelY = 0; pixelY < imageHeight; pixelY++) {
      for (let pixelX = 0; pixelX < imageWidth; pixelX++) {
      redValues.length = 0; 
      greenValues.length = 0; 
      blueValues.length = 0;

        for (let offsetY = -radius; offsetY <= radius; offsetY++) {
          const neighborY = clamp(pixelY + offsetY, 0, imageHeight - 1);
          for (let offsetX = -radius; offsetX <= radius; offsetX++) {
            const neighborX = clamp(pixelX + offsetX, 0, imageWidth - 1);
            const neighborIndex = idx(neighborX, neighborY);

            redValues.push(sourcePixels[neighborIndex]);
            greenValues.push(sourcePixels[neighborIndex + 1]);
            blueValues.push(sourcePixels[neighborIndex + 2]);
          }
        }

      const destIndex = idx(pixelX, pixelY);
      pixels[destIndex] = this.kthOrder(redValues, k);
      pixels[destIndex + 1] = this.kthOrder(greenValues, k);
      pixels[destIndex + 2] = this.kthOrder(blueValues, k);
      }
    }

    return imageData;
    });
  }

  kthOrder(values: number[], k: number): number {
    if (k < 1) {
      k = 1;
    }
    if (k > values.length) {
      k = values.length;
    }
    values.sort((a, b) => a - b);
    return values[k - 1];
  }

  conservativeSmoothing(window: number) {

    const radius = Math.floor(window / 2);

    this.runOnImageData((imageData) => {
      const { width: imageWidth, height: imageHeight, data: pixels } = imageData;
      const sourcePixels = new Uint8ClampedArray(pixels);

      const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);
      const pixelIndex = (x: number, y: number) => ((y * imageWidth + x) << 2);

      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          let redMin = 255, greenMin = 255, blueMin = 255;
          let redMax = 0,   greenMax = 0,   blueMax = 0;

          for (let offY = -radius; offY <= radius; offY++) {
            const ny = clamp(y + offY, 0, imageHeight - 1);
            for (let offX = -radius; offX <= radius; offX++) {
              if ( offX === 0 && offY === 0) continue;
              const newx = clamp(x + offX, 0, imageWidth - 1);
              const newIdx = pixelIndex(newx, ny);

              const r = sourcePixels[newIdx];
              const g = sourcePixels[newIdx + 1];
              const b = sourcePixels[newIdx + 2];

              if (r < redMin) {
                redMin = r;
              }
              if (g < greenMin) {
                greenMin = g;
              }
              if (b < blueMin) {
                blueMin = b;
              }
              if (r > redMax) {
                redMax = r;
              }
              if (g > greenMax) {
                greenMax = g;
              }
              if (b > blueMax) {
                blueMax = b;
              }

            }
          }

          const dIdx = pixelIndex(x, y);
          const r0 = sourcePixels[dIdx], g0 = sourcePixels[dIdx + 1], b0 = sourcePixels[dIdx + 2];

          pixels[dIdx]     = clamp(r0, redMin,   redMax);
          pixels[dIdx + 1] = clamp(g0, greenMin, greenMax);
          pixels[dIdx + 2] = clamp(b0, blueMin,  blueMax);

        }
      }
      return imageData;
    });
  }

  gaussianBlurEx(window: number = 3, sigma: number) {

    const radius = Math.floor(window / 2);
    // build 1D gaussian kernel, normalized
    const kernel = new Float32Array(window);
    let sum = 0;

    for (let i = -radius, j = 0; i <= radius; i++, j++) {
      const v = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel[j] = v; 
      sum += v;
    }

    for (let j = 0; j < window; j++) {
       kernel[j] /= sum;
    }

    const clampIndex = (i: number, n: number) => {
      return (i < 0 ? 0 : (i >= n ? n - 1 : i));
    }

    this.runOnImageData((imageData) => {
      const { width: W, height: H, data: pixels } = imageData;
      const src = new Uint8ClampedArray(pixels);

      const idx = (x: number, y: number) =>  {
        return (y * W + x) * 4;
      }

      // temp buffers for horizontal pass
      const tmpR = new Float32Array(W * H);
      const tmpG = new Float32Array(W * H);
      const tmpB = new Float32Array(W * H);

      // horizontal pass
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let rAcc = 0, gAcc = 0, bAcc = 0;
          for (let k = -radius; k <= radius; k++) {
            const nx = clampIndex(x + k, W);
            const w = kernel[k + radius];
            const sIdx = idx(nx, y);
            rAcc += src[sIdx] * w;
            gAcc += src[sIdx + 1] * w;
            bAcc += src[sIdx + 2] * w;
          }
          const t = y * W + x;
          tmpR[t] = rAcc; 
          tmpG[t] = gAcc; 
          tmpB[t] = bAcc;
        }
      }

      // vertical pass
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let rAcc = 0, gAcc = 0, bAcc = 0;
          for (let k = -radius; k <= radius; k++) {
            const ny = clampIndex(y + k, H);
            const w = kernel[k + radius];
            const t = ny * W + x;
            rAcc += tmpR[t] * w;
            gAcc += tmpG[t] * w;
            bAcc += tmpB[t] * w;
          }
          const d = idx(x, y);
          pixels[d] = Math.round(rAcc);
          pixels[d + 1] = Math.round(gAcc);
          pixels[d + 2] = Math.round(bAcc);
        }
      }

      return imageData;
    });
  }

prewitt(direction: 'magnitude' | 'x' | 'y' = 'magnitude') {
  this.runOnImageData((imageData) => {
    const { width: imageWidth, height: imageHeight, data: pixels } = imageData;
    const src = new Uint8ClampedArray(pixels);

    const clampIndex = (i: number, n: number) => (i < 0 ? 0 : (i >= n ? n - 1 : i));
    const idx = (x: number, y: number) => (y * imageWidth + x) * 4;

    const getLuma = (base: number) =>
      0.299 * src[base] + 0.587 * src[base + 1] + 0.114 * src[base + 2];

    const scaleX = 1 / 3;                  // |gx|max = 3*255  -> 255
    const scaleY = 1 / 3;                  // |gy|max = 3*255  -> 255
    const scaleMag = 1 / (3 * Math.SQRT2); // sqrt(2)*(3*255) -> 255

    const Kernelx = [-1, 0, 1, -1, 0, 1, -1, 0, 1]; 
    const Kernely = [1, 1, 1, 0, 0, 0, -1, -1, -1]; 

    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const xm = clampIndex(x + kx, imageWidth);
            const ym = clampIndex(y + ky, imageHeight);
            const i = idx(xm, ym);

            // grayscale
            const luma = getLuma(i);

            // Convolve with Kernelx (horizontal gradient)
            gx += Kernelx[(ky + 1) * 3 + (kx + 1)] * luma;

            // Convolve with Kernely (vertical gradient)
            gy += Kernely[(ky + 1) * 3 + (kx + 1)] * luma;
          }
        }
        
        let out: number;
        if (direction === 'x') {
          out = Math.abs(gx) * scaleX;
        } else if (direction === 'y') {
          out = Math.abs(gy) * scaleY;
        } else {
          out = Math.hypot(gx, gy) * scaleMag;
        }

        const v = Math.max(0, Math.min(255, Math.round(out)));
        const i11 = idx(x, y);
        pixels[i11]     = v;
        pixels[i11 + 1] = v;
        pixels[i11 + 2] = v;
      }
    }

    return imageData;
  });
}


sobel(direction: 'magnitude' | 'x' | 'y' = 'magnitude') {
  this.runOnImageData((imageData) => {
    const { width: imageWidth, height: imageHeight, data: pixels } = imageData;
    const src = new Uint8ClampedArray(pixels); 

    const clampIndex = (i: number, n: number) => (i < 0 ? 0 : (i >= n ? n - 1 : i));
    const idx = (x: number, y: number) => (y * imageWidth + x) * 4;

    const getLuma = (base: number) =>
      0.299 * src[base] + 0.587 * src[base + 1] + 0.114 * src[base + 2];

    // scale maxim to 255 (|gx|max = |gy|max = 4*255)
    const scaleX = 1 / 4;
    const scaleY = 1 / 4;
    const scaleMag = 1 / (4 * Math.SQRT2);

    // kernels (Gx and Gy)
    const Kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]; 
    const Ky = [1, 2, 1, 0, 0, 0, -1, -2, -1]; 

    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const xm = clampIndex(x + kx, imageWidth);
            const ym = clampIndex(y + ky, imageHeight);
            const i = idx(xm, ym);

            // grayscale
            const luma = getLuma(i);

            // Convolve with Kx (horizontal gradient)
            gx += Kx[(ky + 1) * 3 + (kx + 1)] * luma;
            // Convolve with Ky (vertical gradient)
            gy += Ky[(ky + 1) * 3 + (kx + 1)] * luma;
          }
        }

        let out: number;
        if (direction === 'x') {
          out = Math.abs(gx) * scaleX;
        } else if (direction === 'y') {
          out = Math.abs(gy) * scaleY;
        } else {
          out = Math.hypot(gx, gy) * scaleMag;
        }

        const v = Math.max(0, Math.min(255, Math.round(out)));
        const i11 = idx(x, y);
        pixels[i11]     = v;
        pixels[i11 + 1] = v;
        pixels[i11 + 2] = v;
      }
    }

    return imageData;
  });
}


laplacian(mode: 'abs' | 'signed' = 'abs', neighbors: 4 | 8 = 8) {
  this.runOnImageData((imageData) => {
    const { width: W, height: H, data: pixels } = imageData;
    const src = new Uint8ClampedArray(pixels); 

    const clampIndex = (i: number, n: number) => (i < 0 ? 0 : (i >= n ? n - 1 : i));
    const idx = (x: number, y: number) => (y * W + x) * 4;
    const luma = (p: number) => 0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2];

    const scale = (neighbors === 4) ? (1 / 4) : (1 / 8);

    // laplacian kernels based on the number of neighbors
    const K4 = [0, 1, 0, 1, -4, 1, 0, 1, 0];  // 4 neighbors (Manhattan)
    const K8 = [1, 1, 1, 1, -8, 1, 1, 1, 1];  // 8 neighbors (Chebyshev)
    const kernel = (neighbors === 4) ? K4 : K8;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let L = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const xm = clampIndex(x + kx, W);
            const ym = clampIndex(y + ky, H);
            const i = idx(xm, ym);

            //grayscale
            const l = luma(i);

            // Convolve with the kernel (sum the products of luminance and kernel values)
            L += kernel[(ky + 1) * 3 + (kx + 1)] * l;
          }
        }

        let out: number;
        if (mode === 'abs') {
          out = Math.abs(L) * scale;
        } else { 
          out = L * scale * 0.5 + 127.5;
        }

        const v = Math.max(0, Math.min(255, Math.round(out)));
        const i11 = idx(x, y);
        pixels[i11]     = v;
        pixels[i11 + 1] = v;
        pixels[i11 + 2] = v;
      }
    }
    return imageData;
  });
}

applyCustomKernel(kernel: number[]) {

  this.runOnImageData((imageData) => {
    const { width: W, height: H, data: pixels } = imageData;
    const src = new Uint8ClampedArray(pixels); 

    const clampIndex = (i: number, n: number) => (i < 0 ? 0 : (i >= n ? n - 1 : i));
    const idx = (x: number, y: number) => (y * W + x) * 4;
    
    const luma = (p: number) => 0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let result = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const xm = clampIndex(x + kx, W);
            const ym = clampIndex(y + ky, H);
            const i = idx(xm, ym);

            const l = luma(i);


            const kernelValue = kernel[(ky + 1) * 3 + (kx + 1)];
            result += kernelValue * l;
          }
        }

        let  out = Math.abs(result) * (1/3);

        const v = Math.max(0, Math.min(255, Math.round(out)));
        const i11 = idx(x, y);
        pixels[i11]     = v;
        pixels[i11 + 1] = v;
        pixels[i11 + 2] = v;
      }
    }
    return imageData;
  });
}


// ╔══════════════════╗
// ║     MORFOLOG     ║
// ╚══════════════════╝

dilate() {

  const radius = Math.floor(3 / 2);

  this.runOnImageData((imageData) => {
    const { width: imageWidth, height: imageHeight, data: pixels } = imageData;
    const sourcePixels = new Uint8ClampedArray(pixels); 

    const clampIndex = (i: number, n: number) => (i < 0 ? 0 : (i >= n ? n - 1 : i));
    const pixelIndex = (x: number, y: number) => (y * imageWidth + x) * 4;

    for (let pixelY = 0; pixelY < imageHeight; pixelY++) {
      for (let pixelX = 0; pixelX < imageWidth; pixelX++) {
        let redMax = 0, greenMax = 0, blueMax = 0;

        for (let offsetY = -radius; offsetY <= radius; offsetY++) {
          const neighborY = clampIndex(pixelY + offsetY, imageHeight);
          for (let offsetX = -radius; offsetX <= radius; offsetX++) {
            const neighborX = clampIndex(pixelX + offsetX, imageWidth);
            const n = pixelIndex(neighborX, neighborY);

            const r = sourcePixels[n];
            const g = sourcePixels[n + 1];
            const b = sourcePixels[n + 2];

            if (r > redMax) {
              redMax = r;
            } 
            if (g > greenMax) {
              greenMax = g;
            } 
            if (b > blueMax) {
              blueMax  = b;
            } 
          }
        }

        const d = pixelIndex(pixelX, pixelY);
        pixels[d]     = redMax;
        pixels[d + 1] = greenMax;
        pixels[d + 2] = blueMax;
      }
    }
    return imageData;
  });
}


 erode() {

  const radius = Math.floor(3 / 2);

  this.runOnImageData((imageData) => {
    const { width: imageWidth, height: imageHeight, data: pixels } = imageData;
    const sourcePixels = new Uint8ClampedArray(pixels); 

    const clampIndex = (i: number, n: number) => (i < 0 ? 0 : (i >= n ? n - 1 : i));
    const pixelIndex = (x: number, y: number) => (y * imageWidth + x) * 4;

    for (let pixelY = 0; pixelY < imageHeight; pixelY++) {
      for (let pixelX = 0; pixelX < imageWidth; pixelX++) {
        let redMin = 255, greenMin = 255, blueMin = 255;

        for (let offsetY = -radius; offsetY <= radius; offsetY++) {
          const neighborY = clampIndex(pixelY + offsetY, imageHeight);
          for (let offsetX = -radius; offsetX <= radius; offsetX++) {
            const neighborX = clampIndex(pixelX + offsetX, imageWidth);
            const n = pixelIndex(neighborX, neighborY);

            const r = sourcePixels[n];
            const g = sourcePixels[n + 1];
            const b = sourcePixels[n + 2];

            if (r < redMin) {
              redMin   = r;
            } 
            if (g < greenMin) {
              greenMin = g;
            }
            if (b < blueMin) {
              blueMin  = b;
            } 
          }
        }

        const d = pixelIndex(pixelX, pixelY);
        pixels[d]     = redMin;
        pixels[d + 1] = greenMin;
        pixels[d + 2] = blueMin;
      }
    }
    return imageData;
  });
}

public contour(mode: 'inner' | 'outer' | 'gradient' = 'gradient') {
  // Contorno morfológico:
  // - 'inner'    : original - erode(original)
  // - 'outer'    : dilate(original) - original
  // - 'gradient' : dilate(original) - erode(original)

  const radius = Math.floor(3 / 2);

  this.runOnImageData((imageData) => {
    const { width: imageWidth, height: imageHeight, data: pixels } = imageData;
    const source = new Uint8ClampedArray(pixels); 

    const clampIndex = (i: number, n: number) => (i < 0 ? 0 : (i >= n ? n - 1 : i));
    const pixelIndex = (x: number, y: number) => (y * imageWidth + x) * 4;

    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        let rMin = 255, gMin = 255, bMin = 255;
        let rMax = 0,   gMax = 0,   bMax = 0;

        for (let offY = -radius; offY <= radius; offY++) {
          const ny = clampIndex(y + offY, imageHeight);
          for (let offX = -radius; offX <= radius; offX++) {
            const nx = clampIndex(x + offX, imageWidth);
            const nIdx = pixelIndex(nx, ny);

            const r = source[nIdx];
            const g = source[nIdx + 1];
            const b = source[nIdx + 2];

            if (r < rMin) { 
              rMin = r; 
            }
            if (g < gMin) { 
                gMin = g; 
            }
            if (b < bMin) { 
                bMin = b; 
            }
            if (r > rMax) { 
                rMax = r; 
            }
            if (g > gMax) { 
                gMax = g; 
            }
            if (b > bMax) { 
                bMax = b; 
            }
          }
        }

        const dIdx = pixelIndex(x, y);
        const r0 = source[dIdx], g0 = source[dIdx + 1], b0 = source[dIdx + 2];

        let rOut: number, gOut: number, bOut: number;

        if (mode === 'inner') {
          rOut = r0 - rMin; gOut = g0 - gMin; bOut = b0 - bMin;
        } else if (mode === 'outer') {
          rOut = rMax - r0; gOut = gMax - g0; bOut = bMax - b0;
        } else {
          rOut = rMax - rMin; gOut = gMax - gMin; bOut = bMax - bMin;
        }

        pixels[dIdx]     = rOut < 0 ? 0 : (rOut > 255 ? 255 : rOut | 0);
        pixels[dIdx + 1] = gOut < 0 ? 0 : (gOut > 255 ? 255 : gOut | 0);
        pixels[dIdx + 2] = bOut < 0 ? 0 : (bOut > 255 ? 255 : bOut | 0);
      }
    }
    return imageData;
  });
}

}



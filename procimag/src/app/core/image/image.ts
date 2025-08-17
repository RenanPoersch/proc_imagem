import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../image-service';

// Se usou a interface do exemplo anterior:
interface ImageMetadata {
  container: {
    mime?: string;
    extension?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    bitDepth?: number | number[];
    samplesPerPixel?: number;
    colorSpace?: string;
    compression?: string;
  };
  exif?: Record<string, any> | null;
  iptc?: Record<string, any> | null;
  xmp?: Record<string, any> | null;
  icc?: Record<string, any> | null;
  tiff?: Record<string, any> | null;
  computed?: {
    hasAlpha?: boolean;
    mean?: { r: number; g: number; b: number; a?: number };
    histogram?: { r: number[]; g: number[]; b: number[]; a?: number[] };
  };
}

@Component({
  selector: 'app-image',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image.html',
  styleUrl: './image.css',
  providers: [ImageService]
})
export class Image implements AfterViewInit {
  afterImageDataUrl: string | null = null;

  // matrizes (RGB) já existentes
  rMatrix: number[][] = [];
  gMatrix: number[][] = [];
  bMatrix: number[][] = [];

  // histograma de alpha (opcionalmente pode extrair aMatrix também)
  aHist: number[] = new Array(256).fill(0);

  meta: ImageMetadata | null = null;

  @ViewChild('rCanvas') rCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gCanvas') gCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bCanvas') bCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('aCanvas') aCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(public imageService: ImageService) {}
  ngAfterViewInit() {}

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // 1) carrega imagem (gera DataURL)
    const dataUrl = await this.imageService.uploadPhoto(file);

    // 2) extrai RGB como antes
    const { r, g, b } = await this.imageService.extractColorMatrices(dataUrl);
    this.rMatrix = r;
    this.gMatrix = g;
    this.bMatrix = b;

    // 3) extrai metadados completos (EXIF/IPTC/XMP/TIFF + derivados: hist/means/alpha)
    //    (se você já chamou isso dentro do uploadPhoto, pode só this.meta = this.imageService.getMetadata();)
    this.meta = await (this.imageService as any).extractAllMetadata
      ? await (this.imageService as any).extractAllMetadata(file)
      : this.imageService.getMetadata();

    // 4) pega histograma de A (se disponível nos derivados)
    this.aHist = this.meta?.computed?.histogram?.a ?? new Array(256).fill(0);

    // desenha tudo
    setTimeout(() => this.drawAllCharts(), 0);
  }

  drawAllCharts() {
    this.drawHistogramFromMatrix(this.rCanvas?.nativeElement, this.rMatrix, 'red');
    this.drawHistogramFromMatrix(this.gCanvas?.nativeElement, this.gMatrix, 'green');
    this.drawHistogramFromMatrix(this.bCanvas?.nativeElement, this.bMatrix, 'blue');
    this.drawHistogramFromHist(this.aCanvas?.nativeElement, this.aHist, 'gray');
  }

  // --- desenha histograma a partir das matrizes (R/G/B)
  private drawHistogramFromMatrix(canvas: HTMLCanvasElement | undefined, matrix: number[][], color: string) {
    if (!canvas || !matrix.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hist = new Array(256).fill(0);
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[0].length; x++) {
        hist[matrix[y][x]]++;
      }
    }
    this.drawBars(ctx, hist, color, canvas.width, canvas.height);
  }

  // --- desenha histograma a partir de um vetor pronto (Alpha)
  private drawHistogramFromHist(canvas: HTMLCanvasElement | undefined, hist: number[], color: string) {
    if (!canvas || !hist?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawBars(ctx, hist, color, canvas.width, canvas.height);
  }

  // --- rotina comum para desenhar barras com escala X correta
  private drawBars(
    ctx: CanvasRenderingContext2D,
    hist: number[],
    width: number,
    height: number
  ): void;
  private drawBars(
    ctx: CanvasRenderingContext2D,
    hist: number[],
    color: string,
    width: number,
    height: number
  ): void;
  private drawBars(
    ctx: CanvasRenderingContext2D,
    hist: number[],
    colorOrWidth: string | number,
    maybeWidth?: number,
    maybeHeight?: number
  ) {
    let color = 'black', w = ctx.canvas.width, h = ctx.canvas.height;
    if (typeof colorOrWidth === 'string') {
      color = colorOrWidth;
      w = maybeWidth ?? w;
      h = maybeHeight ?? h;
    } else {
      w = colorOrWidth;
      h = maybeWidth ?? h;
    }

    const max = Math.max(...hist) || 1;
    const scaleX = w / 256;
    ctx.fillStyle = color;

    for (let i = 0; i < 256; i++) {
      const barHeight = (hist[i] / max) * h;
      ctx.fillRect(i * scaleX, h - barHeight, Math.max(1, scaleX), barHeight);
    }
  }

  // utilidades de debug
  greenPrint() { console.log('Green Matrix:', this.gMatrix); }
  redPrint()   { console.log('Red Matrix:', this.rMatrix); }
  bluePrint()  { console.log('Blue Matrix:', this.bMatrix); }
}

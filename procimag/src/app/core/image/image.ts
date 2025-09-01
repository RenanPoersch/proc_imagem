import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../image-service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-image',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image.html',
  styleUrl: './image.css',
})
export class Image implements AfterViewInit {

  rMatrix: number[][] = [];
  gMatrix: number[][] = [];
  bMatrix: number[][] = [];

  aHist: number[] = new Array(256).fill(0);

  meta: any = null;

  @ViewChild('rCanvas') rCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gCanvas') gCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bCanvas') bCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('aCanvas') aCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(public imageService: ImageService, public router: Router ) {}

  ngAfterViewInit() {}

  ngOnInit() {
    fetch('assets/eightSaltPepper.tif')
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'eightSaltPepper.tif', { type: blob.type });
        return this.imageService.uploadPhoto(file);
      })
      .then(dataUrl => {
      })
      .catch(error => {
        console.error('Erro ao carregar imagem:', error);
      });

  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const dataUrl = await this.imageService.uploadPhoto(file);

    await this.imageService.extractColorMatrices(dataUrl);
    this.rMatrix = this.imageService.getRMatrix();
    this.gMatrix = this.imageService.getGMatrix();
    this.bMatrix = this.imageService.getBMatrix();

    // 3) extrai metadados completos (EXIF/IPTC/XMP/TIFF + derivados: hist/means/alpha)
    //    (se você já chamou isso dentro do uploadPhoto, pode só this.meta = this.imageService.getMetadata();)
    this.meta = await (this.imageService as any).extractAllMetadata
      ? await (this.imageService as any).extractAllMetadata(file)
      : this.imageService.getMetadata();

    // 4) pega histograma de A (se disponível nos derivados)
    this.aHist = this.meta?.computed?.histogram?.a ?? new Array(256).fill(0);

    setTimeout(() => this.drawAllCharts(), 0);
  }

  drawAllCharts() {
    this.drawHistogramFromMatrix(this.rCanvas?.nativeElement, this.rMatrix, 'red');
    this.drawHistogramFromMatrix(this.gCanvas?.nativeElement, this.gMatrix, 'green');
    this.drawHistogramFromMatrix(this.bCanvas?.nativeElement, this.bMatrix, 'blue');
  }

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

  onKeepImage() {
    this.imageService.setImageDataUrl(this.imageService.getEditedImageDataUrl());
  }

  greenPrint() { console.log('Green Matrix:', this.gMatrix); }
  redPrint()   { console.log('Red Matrix:', this.rMatrix); }
  bluePrint()  { console.log('Blue Matrix:', this.bMatrix); }
}

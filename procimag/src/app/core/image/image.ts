import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../image-service';

@Component({
  selector: 'app-image',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image.html',
  styleUrl: './image.css',
  providers: [ImageService]
})
export class Image implements AfterViewInit {
  imageDataUrl: string | null = null;
  afterImageDataUrl: string | null = null;
  rMatrix: number[][] = [];
  gMatrix: number[][] = [];
  bMatrix: number[][] = [];

  @ViewChild('rCanvas') rCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gCanvas') gCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bCanvas') bCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(private imageService: ImageService) {}

  ngAfterViewInit() {}

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.imageService.uploadPhoto(file).then(dataUrl => {
        this.imageDataUrl = dataUrl;
        this.imageService.extractColorMatrices(dataUrl).then(({ r, g, b }) => {
          this.rMatrix = r;
          this.gMatrix = g;
          this.bMatrix = b;
          setTimeout(() => this.drawAllCharts(), 0);
        });
      });
    }
  }

  drawAllCharts() {
    this.drawHistogram(this.rCanvas?.nativeElement, this.rMatrix, 'red');
    this.drawHistogram(this.gCanvas?.nativeElement, this.gMatrix, 'green');
    this.drawHistogram(this.bCanvas?.nativeElement, this.bMatrix, 'blue');
  }

  drawHistogram(canvas: HTMLCanvasElement | undefined, matrix: number[][], color: string) {
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
    const max = Math.max(...hist);
    const width = canvas.width;
    const height = canvas.height;

    for (let i = 0; i < 256; i++) {
      const barHeight = (hist[i] / max) * height;
      ctx.fillStyle = color;
      ctx.fillRect(i, height - barHeight, 1, barHeight);
    }
  }
}
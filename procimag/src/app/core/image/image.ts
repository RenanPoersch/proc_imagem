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
  rMatrix: number[][] = [];
  gMatrix: number[][] = [];
  bMatrix: number[][] = [];

  @ViewChild('rCanvas') rCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gCanvas') gCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('bCanvas') bCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(private imageService: ImageService) {}

  ngAfterViewInit() {
    // Os gráficos só serão desenhados após upload, veja drawAllCharts abaixo
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.imageService.uploadPhoto(file).then(dataUrl => {
        this.imageDataUrl = dataUrl;
        this.imageService.extractColorMatrices(dataUrl).then(({ r, g, b }) => {
          this.rMatrix = r;
          this.gMatrix = g;
          this.bMatrix = b;
          setTimeout(() => this.drawAllCharts(), 0); // Aguarda o ViewChild atualizar
        });
      });
    }
  }

  drawAllCharts() {
    this.drawMatrix(this.rCanvas?.nativeElement, this.rMatrix, 'red');
    this.drawMatrix(this.gCanvas?.nativeElement, this.gMatrix, 'green');
    this.drawMatrix(this.bCanvas?.nativeElement, this.bMatrix, 'blue');
  }

  drawMatrix(canvas: HTMLCanvasElement | undefined, matrix: number[][], color: string) {
    if (!canvas || !matrix.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Exemplo: desenha a média de cada coluna como um gráfico de barras
    const width = canvas.width;
    const height = canvas.height;
    const cols = matrix[0].length;
    const rows = matrix.length;

    for (let x = 0; x < cols; x++) {
      let sum = 0;
      for (let y = 0; y < rows; y++) {
        sum += matrix[y][x];
      }
      const avg = sum / rows;
      ctx.fillStyle = color;
      ctx.fillRect(x, height - (avg / 255) * height, 1, (avg / 255) * height);
    }
  }
}
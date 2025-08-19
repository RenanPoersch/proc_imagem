import { Component } from '@angular/core';
import { ImageService } from '../../core/image-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-aritmetica',
  imports: [CommonModule, FormsModule],
  templateUrl: './aritmetica.html',
  styleUrl: './aritmetica.css',
  standalone: true
})

export class Aritmetica {
  Math = Math;

  brilho: number = 0;
  valorAddA: number = 100;
  valorAddB: number = 100;
  contrast: number = 0;

  constructor(public imageService: ImageService) {}

  contrastFactorFromSlider(value: number): number {
    return 1 + (value / 100) * 2;
  }

  onSecondaryFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imageService.uploadSecondaryPhoto(file);
  }

  onBrightnessChange(x?: number) {
    if (!this.imageService.hasProcessableImage) {
      console.warn('Slider chamado sem imagem ainda.');
      return;
    }
    this.imageService.adjustBrightness(x ? x : this.brilho, x ? 'x' : null);
  }

  addImage(operation?: string) {
    if (!this.imageService.hasProcessableImage) {
      console.warn('Slider chamado sem imagem ainda.');
      return;
    }
    this.imageService.addImage({a: this.valorAddA, b: this.valorAddB}, operation);
  }

  onContrastChange() {
    if (!this.imageService.hasProcessableImage) return;
    const factor = this.contrastFactorFromSlider(this.contrast);
    this.imageService.adjustContrast(factor);
  }
}

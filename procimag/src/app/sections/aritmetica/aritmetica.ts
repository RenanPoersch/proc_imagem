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

  async onSecondaryFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await this.imageService.uploadSecondaryPhoto(file);
  }

  async onBrightnessChange() {
    if (!this.imageService.hasProcessableImage) {
      console.warn('Slider chamado sem imagem ainda.');
      return;
    }
    await this.imageService.adjustBrightness(this.brilho);
  }

  async addImage(operation?: string) {
    if (!this.imageService.hasProcessableImage) {
      console.warn('Slider chamado sem imagem ainda.');
      return;
    }
    await this.imageService.addImage({a: this.valorAddA, b: this.valorAddB}, operation);
  }

  async onContrastChange() {
    if (!this.imageService.hasProcessableImage) return;
    const factor = this.contrastFactorFromSlider(this.contrast);
    await this.imageService.adjustContrast(factor);
  }

  contrastFactorFromSlider(s: number): number {
    const C = (s / 100) * 255;
    return (259 * (C + 255)) / (255 * (259 - C));
  }
}

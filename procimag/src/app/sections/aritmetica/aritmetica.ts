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
  brilho: number = 0;

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
}

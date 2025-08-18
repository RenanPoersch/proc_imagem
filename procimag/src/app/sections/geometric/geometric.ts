import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImageService } from '../../core/image-service';

@Component({
  selector: 'app-geometric',
  imports: [CommonModule, FormsModule],
  templateUrl: './geometric.html',
  styleUrl: './geometric.css'
})
export class Geometric {
  constructor(public imageService: ImageService) {}


  async flip(direction: 'hor' | 'ver') {
    if (!this.imageService.hasProcessableImage) {
      console.warn('Slider chamado sem imagem ainda.');
      return;
    }
    await this.imageService.flipImage(direction);
  }
}

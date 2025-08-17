import { Component } from '@angular/core';
import { ImageService } from '../../core/image-service';

@Component({
  selector: 'app-aritmetica',
  imports: [],
  templateUrl: './aritmetica.html',
  styleUrl: './aritmetica.css',
  standalone: true
})
export class Aritmetica {
  constructor(public imageService: ImageService) {}

  async onSecondaryFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await this.imageService.uploadSecondaryPhoto(file);
  }
}

import { Component } from '@angular/core';
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
export class Image {
  imageDataUrl: string | null = null;

  constructor(private imageService: ImageService) {}

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.imageService.uploadPhoto(file).then(dataUrl => {
        this.imageDataUrl = dataUrl;
      });
    }
  }
}
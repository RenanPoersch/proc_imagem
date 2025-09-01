import { Component } from '@angular/core';
import { ImageService } from '../../core/image-service';

@Component({
  selector: 'app-logic',
  imports: [],
  templateUrl: './logic.html',
  styleUrl: './logic.css'
})
export class Logic {
  constructor(public imageService: ImageService) {}

  addImage(operation: 'and' | 'not' | 'or' | 'xor') {
    this.imageService.addGate(operation);
  }

  onSecondaryFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imageService.uploadSecondaryPhoto(file);
  }
}

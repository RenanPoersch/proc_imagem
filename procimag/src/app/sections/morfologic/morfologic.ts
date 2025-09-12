import { Component } from '@angular/core';
import { ImageService } from '../../core/image-service';

@Component({
  selector: 'app-morfologic',
  imports: [],
  templateUrl: './morfologic.html',
  styleUrl: './morfologic.css'
})
export class Morfologic {
  constructor(public imageService: ImageService) {}

  dilate() {
    this.imageService.dilate()
  }
  
  erode() {
    this.imageService.erode()
  }
 
  contour(mode: 'inner' | 'outer' | 'gradient' = 'gradient') {
    this.imageService.contour(mode)
  }
}

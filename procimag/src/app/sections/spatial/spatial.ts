import { Component } from '@angular/core';
import { ImageService } from '../../core/image-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-spatial',
  imports: [CommonModule, FormsModule],
  templateUrl: './spatial.html',
  styleUrl: './spatial.css'
})
export class Spatial {
  constructor(public imageService: ImageService) {}
  window = 3;
  order = 1;
  kind: 'min' | 'max' | 'mean' = 'min'
  sigma = 0.5 

  lpNeig: 4 | 8 = 8;

  applyLocalFilter() {
    this.imageService.applyLocalFilter(this.kind, this.window);
  }
  
  applyAverage() {
    this.imageService.applyMedianFilter(this.window);
  }

  applyOrder() {
    this.imageService.applyOrderFilter(this.window, this.order);
  }

  conservativeSmoothing() {
    this.imageService.conservativeSmoothing(this.window);
  }

  gaussianBlurEx() {
    this.imageService.gaussianBlurEx(this.window, this.sigma);
  }

  prewitt() {
    this.imageService.prewitt();
  }

  sobel(dir: 'magnitude' | 'x' | 'y') {
    this.imageService.sobel(dir);
  }

  laplace(mode: 'abs' | 'signed', neig?: 4 | 8) {
    this.imageService.laplacian(mode, neig);
  }

  changeFilterKind(kind: 'min' | 'max' | 'mean') {
    this.kind = kind;
    this.applyLocalFilter();
  } 
}

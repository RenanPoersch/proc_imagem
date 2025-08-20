import { Component } from '@angular/core';
import { ImageService } from '../../core/image-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type RGBKey = 'r' | 'g' | 'b';

@Component({
  selector: 'app-color',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './color.html',
  styleUrls: ['./color.css']
})
export class Color {
  constructor(public imageService: ImageService) {}

  r = 0.299;
  g = 0.587;
  b = 0.114;

  colorsMat: { r: number; g: number; b: number } = { r: 0.299, g: 0.587, b: 0.114 };

  private clamp01(x: number) {
    return Math.min(1, Math.max(0, x));
  }

  private round3(x: number) {
    return Math.round(x * 1000) / 1000;
  }

  private normalizeSumTo1() {
    const sum = this.r + this.g + this.b;
    const diff = this.round3(1 - sum);

    if (diff === 0) {
      return
    };

    const entries: [RGBKey, number][] = [['r', this.r], ['g', this.g], ['b', this.b]];
    const [maxK] = entries.reduce((a, b) => (a[1] >= b[1] ? a : b));
    this[maxK] = this.round3(this.clamp01(this[maxK] + diff));
  }


  onSlider(clr: RGBKey) {

    this[clr] = this.clamp01(this[clr]);

    const others = (['r', 'g', 'b'] as RGBKey[]).filter(k => k !== clr);

    const newValue = this[clr];
    const remaining = this.clamp01(1 - newValue);

    const oldO1 = this[others[0]];
    const oldO2 = this[others[1]];
    const sumOldOthers = oldO1 + oldO2;

    if (sumOldOthers === 0) {
      this[others[0]] = remaining / 2;
      this[others[1]] = remaining / 2;
    } else {
      const k = remaining / sumOldOthers;
      this[others[0]] = oldO1 * k;
      this[others[1]] = oldO2 * k;
    }

    this.r = this.round3(this.r);
    this.g = this.round3(this.g);
    this.b = this.round3(this.b);
    this.normalizeSumTo1();

    this.colorsMat = { r: this.r, g: this.g, b: this.b };

    this.toGreyScale(this.colorsMat);
  }

  toGreyScale(mat: { r: number; g: number; b: number }) {
    const { r: wr, g: wg, b: wb } = mat;
    if (wr + wg + wb > 1.001) {
      return
    };
    this.imageService.toGrayscaleLinear(wr, wg, wb);
  }

  backToBasicGrey() {
    this.r = 0.299;
    this.g = 0.587;
    this.b = 0.114;
    this.colorsMat = { r: this.r, g: this.g, b: this.b };
    this.toGreyScale(this.colorsMat);
  }
}

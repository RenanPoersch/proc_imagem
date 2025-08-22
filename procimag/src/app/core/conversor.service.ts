import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConversorService {
  hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = (h % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (0 <= hp && hp < 1) { r = c; g = x; b = 0; }
    else if (1 <= hp && hp < 2) { r = x; g = c; b = 0; }
    else if (2 <= hp && hp < 3) { r = 0; g = c; b = x; }
    else if (3 <= hp && hp < 4) { r = 0; g = x; b = c; }
    else if (4 <= hp && hp < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const m = l - c / 2;
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  rgbToHsl(r255: number, g255: number, b255: number): [number, number, number] {
    const r = r255 / 255, g = g255 / 255, b = b255 / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    let s = 0;
    if (d !== 0) s = d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
      switch (max) {
        case r: h = 60 * (((g - b) / d) % 6); break;
        case g: h = 60 * (((b - r) / d) + 2); break;
        default: h = 60 * (((r - g) / d) + 4); break;
      }
    }
    if (h < 0) h += 360;
    return [h, s, l];
  }
}

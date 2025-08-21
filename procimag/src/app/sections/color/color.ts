import { Component } from '@angular/core';
import { ImageService } from '../../core/image-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxKnobModule } from 'ngx-knob';

type RGBKey = 'r' | 'g' | 'b';

@Component({
  selector: 'app-color',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxKnobModule],
  templateUrl: './color.html',
  styleUrls: ['./color.css']
})
export class Color {
  constructor(public imageService: ImageService) {}

  r = 0.299;
  g = 0.587;
  b = 0.114;

  rGain = 0;
  gGain = 0;
  bGain = 0;

  tolR = 30;
  tolG = 30;
  tolB = 30;


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

  colorGrade(value: number, RGBKey: 'r' | 'g' | 'b') {
    this.imageService.colorGrade(value, RGBKey);
  }


    private debounceId: any = null;

  // ===== Handlers dos sliders =====
  onGainChange(ch: RGBKey, v: number) {
    this[`${ch}Gain` as const] = v;
    this.debouncedApply();
  }

  onTolChange(ch: RGBKey, v01: number) {
    this[`tol${ch.toUpperCase() as 'R'|'G'|'B'}`] = v01;
    this.debouncedApply();
  }

  private debouncedApply(delay = 80) {
    clearTimeout(this.debounceId);
    this.debounceId = setTimeout(() => this.applyEnhance(), delay);
  }

  // ===== Aplicação do efeito (perceptual) =====
  private applyEnhance() {
    // exemplo: partindo do frame atual (ajuste conforme seu fluxo de imagem)
    this.runOnImageData((img) => {
      // aplica em sequência para R, G, B
      let out = img;
      out = this.enhanceRGBKeyPerceptual(
        out, 'r',
        this.satFactorFromGain(this.rGain),
        this.toleranceDegFrom01(this.tolR)
      );
      out = this.enhanceRGBKeyPerceptual(
        out, 'g',
        this.satFactorFromGain(this.gGain),
        this.toleranceDegFrom01(this.tolG)
      );
      out = this.enhanceRGBKeyPerceptual(
        out, 'b',
        this.satFactorFromGain(this.bGain),
        this.toleranceDegFrom01(this.tolB)
      );
      return out;
    });
  }

  private satFactorFromGain(gain: number) {
    // -255..255 → 0..2 (neutro=1)
    const f = 1 + gain / 255;
    // limite opcional p/ não exagerar
    return Math.min(1.6, Math.max(0, f));
  }

  private toleranceDegFrom01(v01: number) {
    // 0..1 → 0..60°
    return Math.round(v01 * 60);
  }

  // ===== Conversões RGB <-> HSL + realce perceptual =====
  private rgbToHsl(r255: number, g255: number, b255: number): [number, number, number] {
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

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
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

  private hueForRGBKey(ch: RGBKey): number {
    return ch === 'r' ? 0 : ch === 'g' ? 120 : 240;
  }
  private hueDist(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  private enhanceRGBKeyPerceptual(
    imageData: ImageData,
    RGBKey: RGBKey,
    satFactor: number,
    toleranceDeg: number
  ): ImageData {
    const d = imageData.data;
    const targetH = this.hueForRGBKey(RGBKey);

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      let [h, s, l] = this.rgbToHsl(r, g, b);

      // peso suave: 1 no alvo, 0 na borda
      const dist = this.hueDist(h, targetH);
      const w = toleranceDeg <= 0 ? 0 : Math.max(0, 1 - dist / toleranceDeg);

      if (w > 0) {
        const sOut = Math.min(1, s * (1 + (satFactor - 1) * w));
        const [nr, ng, nb] = this.hslToRgb(h, sOut, l);
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      }
    }
    return imageData;
  }

  // ===== Coloque seu helper real aqui =====
  // Deve receber um callback que recebe ImageData e retorna ImageData
  private runOnImageData(fn: (img: ImageData) => ImageData) {
    // exemplo: adapte ao seu ImageService/canvas
    this.imageService.runOnImageData(fn);
  }

  startRotate(event: PointerEvent, channel: 'r' | 'g' | 'b') {
    const knobEl = event.currentTarget as HTMLElement; 
    const rect = knobEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    knobEl.setPointerCapture?.(event.pointerId);

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      let deg = Math.atan2(-dy, -dx) * (180 / Math.PI);
      if (deg < 0) deg += 360;

      let newDeg: number;
      if (dy > 0) {
        newDeg = dx < 0 ? 0 : 180;
      } else {
        if (deg > 180) deg = 180;
        newDeg = Math.round(deg);
      }

      if (channel === 'r') this.tolR = newDeg;
      else if (channel === 'g') this.tolG = newDeg;
      else this.tolB = newDeg;

      this.debouncedApply();
    };

    const onUp = () => {
      knobEl.releasePointerCapture?.(event.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

}

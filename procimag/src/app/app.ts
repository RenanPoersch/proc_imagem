import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Image } from './core/image/image';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Image],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('procimag');
}

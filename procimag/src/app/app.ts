import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Image } from './core/image/image';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Image, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('procimag');
}

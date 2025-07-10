import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CreateItemComponent } from './components/create-item/create-item.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CreateItemComponent],
  templateUrl: './app.html',
  styles: [],
})
export class App {
  protected readonly title = signal('moving-tags');
}

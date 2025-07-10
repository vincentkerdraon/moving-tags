import { Component, signal } from '@angular/core';
import { EditItemComponent } from './components/edit-item/edit-item.component';

@Component({
  selector: 'app-root',
  imports: [EditItemComponent],
  templateUrl: './app.html',
  styles: [],
})
export class App {
  protected readonly title = signal('moving-tags');
}

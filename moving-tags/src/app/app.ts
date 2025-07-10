import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { EditItemComponent } from './components/edit-item/edit-item.component';
import { ItemService } from './services/item.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, EditItemComponent,RouterLink],
  templateUrl: './app.html',
  styles: [],
  standalone: true,
})
export class App implements OnInit {
  showEditPopup = false;
  popupItem: any = null;

  constructor(private itemService: ItemService) {}

  ngOnInit() {
    this.itemService.generateFakeData();
  }

  onItemCreated(item: any) {}
  closeEditPopup() {}
}

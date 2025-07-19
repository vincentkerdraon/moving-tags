import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { EditItemComponent } from './components/edit-item/edit-item.component';
import { ErrorComponent } from "./components/error/error.component";
import { ErrorService } from './services/error.service';
import { ItemService } from './services/item.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, ErrorComponent, ErrorComponent, EditItemComponent],
  templateUrl: './app.html',
  styles: [],
  standalone: true,
})
export class App {

  showEditPopup = false;
  popupItem: any = null;
  testDataAlertDismissed = false;

  constructor(private itemService: ItemService, public errorService: ErrorService) { }



  get showTestDataAlert(): boolean {
    return this.itemService.items.length === 0 && !this.testDataAlertDismissed;
  }

  generateTestData() {
    this.itemService.generateFakeData();
  }

  hideTestDataAlert() {
    this.testDataAlertDismissed = true;
  }

  onItemCreated(item: any) { }
  closeEditPopup() { }

  showError(message: string) {
    this.errorService.showError(message);
  }

  clearError() {
    this.errorService.clearError();
  }
}

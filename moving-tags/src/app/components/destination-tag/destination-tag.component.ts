import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DestinationTag } from '../../models/data.models';

/**
 * Displays a destination tag with a distinct color.
 */
@Component({
  selector: 'app-destination-tag',
  standalone: true,
  imports: [NgIf],
  template: `
    <span *ngIf="destination" class="badge bg-warning text-dark border border-dark me-1">
      {{ destination }}
    </span>
  `,
})
export class DestinationTagComponent {
  @Input() destination?: DestinationTag;
}

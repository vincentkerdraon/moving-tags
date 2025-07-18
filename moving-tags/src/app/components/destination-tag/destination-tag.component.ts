import { Component, Input } from '@angular/core';
import { DestinationTag } from '../../models/data.models';

/**
 * Displays a destination tag with a distinct color.
 */
@Component({
  selector: 'app-destination-tag',
  standalone: true,
  template: `
    <span class="badge bg-destination-tag text-light border border-dark me-1">
      {{ destination }}
    </span>
  `,
})
export class DestinationTagComponent {
  @Input() destination?: DestinationTag;
}

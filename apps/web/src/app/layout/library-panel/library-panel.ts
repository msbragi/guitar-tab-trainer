import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/icon/icon.js';

@Component({
  selector: 'gp-library-panel', imports: [TranslocoPipe, Icon],
  templateUrl: './library-panel.html',
  styleUrl: './library-panel.css',
})
export class LibraryPanel {
  readonly collapsed = input(false);
  readonly busy = input(false);
  readonly toggle = output<void>();
  readonly openTab = output<void>();
}

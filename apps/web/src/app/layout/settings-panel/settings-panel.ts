import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../theme/theme.service.js';
import { Icon } from '../../shared/icon/icon.js';

@Component({
  selector: 'gp-settings-panel', imports: [TranslocoPipe, Icon],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.css',
})
export class SettingsPanel {
  readonly theme = inject(ThemeService);
  selectTheme(event: Event): void { this.theme.select((event.target as HTMLSelectElement).value); }
}

import { Component, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service.js';
import { Icon } from '../../shared/icon/icon.js';
import type { Section } from '../navigation.js';

@Component({
  selector: 'gp-app-header',
  imports: [TranslocoPipe, Icon],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
  readonly active = input<Section>('practice');
  readonly navigate = output<Section>();
  readonly language = inject(LanguageService);
  readonly version = '0.0.0';

  goHome(): void {
    this.navigate.emit('practice');
  }

  toggleSettings(): void {
    this.navigate.emit(this.active() === 'settings' ? 'practice' : 'settings');
  }
}

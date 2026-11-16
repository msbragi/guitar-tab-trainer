import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../theme/theme.service.js';
import { Icon } from '../shared/icon.js';

@Component({
  selector: 'gp-settings-panel', imports: [TranslocoPipe, Icon],
  template: `<section class="section-page settings-page" [attr.aria-label]="'nav.settings' | transloco">
    <span class="section-symbol"><gp-icon name="settings" /></span><p class="eyebrow">{{ 'shell.preferences' | transloco }}</p>
    <h2>{{ 'nav.settings' | transloco }}</h2><p class="section-description">{{ 'theme.description' | transloco }}</p>
    <div class="settings-card"><label for="theme-select">{{ 'theme.label' | transloco }}</label>
      <select id="theme-select" [value]="theme.preference()" (change)="selectTheme($event)">
        <option value="system">{{ 'theme.system' | transloco }}</option>
        <option value="light">{{ 'theme.light' | transloco }}</option>
        <option value="dark">{{ 'theme.dark' | transloco }}</option>
      </select><p class="muted">{{ 'theme.saved' | transloco }}</p></div>
    <p class="section-description">{{ 'shell.settingsUnavailable' | transloco }}</p>
  </section>`,
})
export class SettingsPanel {
  readonly theme = inject(ThemeService);
  selectTheme(event: Event): void { this.theme.select((event.target as HTMLSelectElement).value); }
}

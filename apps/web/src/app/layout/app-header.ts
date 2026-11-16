import { Component, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../i18n/language.service.js';
import { Icon } from '../shared/icon.js';
import { sections } from './navigation.js';
import type { Section } from './navigation.js';

@Component({
  selector: 'gp-app-header',
  imports: [TranslocoPipe, Icon],
  template: `
    <header class="app-header">
      <div class="brand"><span class="brand-mark"><gp-icon name="guitar" /></span>
        <div><div class="brand-title"><h1>{{ 'app.name' | transloco }}</h1><span class="version">v{{ version }}</span></div>
          <p>{{ 'shell.tagline' | transloco }}</p></div>
      </div>
      <button class="icon-button mobile-menu" type="button" [attr.aria-label]="'shell.toggleNavigation' | transloco"
        [attr.aria-expanded]="menuOpen()" aria-controls="primary-navigation" (click)="menuOpen.set(!menuOpen())"><gp-icon name="menu" /></button>
      <nav id="primary-navigation" class="primary-navigation" [class.menu-open]="menuOpen()" [attr.aria-label]="'shell.navigation' | transloco">
        @for (item of sections; track item.id) {
          <button type="button" [class.active]="active() === item.id" [attr.aria-current]="active() === item.id ? 'page' : null"
            (click)="choose(item.id)"><gp-icon [name]="item.icon" /><span>{{ ('nav.' + item.id) | transloco }}</span></button>
        }
      </nav>
      <div class="language-picker" role="group" [attr.aria-label]="'language.label' | transloco">
        <button type="button" lang="en" [title]="'language.english' | transloco" [attr.aria-pressed]="language.current() === 'en'" (click)="language.select('en')">EN</button>
        <button type="button" lang="it" [title]="'language.italian' | transloco" [attr.aria-pressed]="language.current() === 'it'" (click)="language.select('it')">IT</button>
      </div>
    </header>`,
})
export class AppHeader {
  readonly active = input<Section>('practice');
  readonly navigate = output<Section>();
  readonly language = inject(LanguageService);
  readonly menuOpen = signal(false);
  readonly sections = sections;
  readonly version = '0.0.0';
  choose(section: Section): void { this.navigate.emit(section); this.menuOpen.set(false); }
}

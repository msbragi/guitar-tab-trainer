import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { parseTheme, resolveTheme, THEME_STORAGE_KEY } from './theme-preferences.js';
import type { ThemePreference } from './theme-preferences.js';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private readonly selected = signal<ThemePreference>('system');
  readonly preference = this.selected.asReadonly();
  private media: MediaQueryList | undefined;

  initialize(): void {
    const browser = this.document.defaultView;
    try { this.selected.set(parseTheme(browser?.localStorage.getItem(THEME_STORAGE_KEY))); }
    catch { this.selected.set('system'); }
    this.media = browser?.matchMedia('(prefers-color-scheme: dark)');
    const update = () => this.apply();
    this.media?.addEventListener('change', update);
    this.destroy.onDestroy(() => this.media?.removeEventListener('change', update));
    this.apply();
  }

  select(value: string): void {
    this.selected.set(parseTheme(value));
    try { this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, this.selected()); }
    catch { /* La preferenza resta valida nella sessione corrente. */ }
    this.apply();
  }

  private apply(): void {
    const theme = resolveTheme(this.selected(), this.media?.matches ?? false);
    this.document.documentElement.dataset['theme'] = theme;
    this.document.documentElement.style.colorScheme = theme;
  }
}

import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { initialLanguage, isLanguage, readPreference, savePreference } from './language-preferences.js';
import type { Language } from './language-preferences.js';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translations = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly active = signal<Language>('en');
  readonly current = this.active.asReadonly();
  private storage: Storage | undefined;

  async initialize(): Promise<void> {
    const browser = this.document.defaultView;
    try { this.storage = browser?.localStorage; }
    catch { /* Alcuni browser vietano anche l'accesso alla proprietà localStorage. */ }
    const languages = browser?.navigator.languages ?? [browser?.navigator.language ?? ''];
    const selected = initialLanguage(readPreference(this.storage), languages);
    // Entrambi i piccoli cataloghi locali sono pronti prima di mostrare la UI.
    // EN è disponibile anche per chiavi mancanti nel catalogo italiano.
    await firstValueFrom(this.translations.load('en'));
    try { await firstValueFrom(this.translations.load('it')); }
    catch { this.activate('en'); return; }
    this.activate(selected);
  }

  select(language: Language): void {
    if (!isLanguage(language)) return;
    this.activate(language);
    savePreference(this.storage, language);
  }

  private activate(language: Language): void {
    this.translations.setActiveLang(language);
    this.active.set(language);
    this.document.documentElement.lang = language;
  }
}

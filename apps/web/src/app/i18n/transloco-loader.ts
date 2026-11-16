import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class LocalTranslationLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  getTranslation(language: string) {
    return this.http.get<Translation>(new URL(`assets/i18n/${language}.json`, this.document.baseURI).href);
  }
}

import { provideHttpClient } from '@angular/common/http';
import { inject, isDevMode, provideAppInitializer } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { LanguageService } from './i18n/language.service.js';
import { LocalTranslationLoader } from './i18n/transloco-loader.js';
import { ThemeService } from './theme/theme.service.js';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAppInitializer(() => inject(ThemeService).initialize()),
    provideTransloco({
      config: {
        availableLangs: ['en', 'it'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        failedRetries: 0,
        missingHandler: { useFallbackTranslation: true },
        prodMode: !isDevMode(),
      },
      loader: LocalTranslationLoader,
    }),
    provideAppInitializer(() => inject(LanguageService).initialize()),
  ],
};

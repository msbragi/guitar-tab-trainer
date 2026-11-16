import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, signal, viewChild } from '@angular/core';
import type { ElementRef, OnDestroy } from '@angular/core';
import { ScoreController, ScoreLoadError } from '@guitar-practice/core';
import type { ScoreState } from '@guitar-practice/core';
import { AlphaTabScoreAdapter } from '@guitar-practice/alphatab-adapter';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from './i18n/language.service.js';

@Component({
  selector: 'gp-app',
  imports: [TranslocoPipe],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  readonly language = inject(LanguageService);
  readonly state = signal<ScoreState>({ status: 'idle' });
  readonly available = signal(false);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('scoreHost');
  private readonly document = inject(DOCUMENT);
  private controller: ScoreController | undefined;
  private adapter: AlphaTabScoreAdapter | undefined;
  private unsubscribe: (() => void) | undefined;

  constructor() {
    afterNextRender(() => {
      this.adapter = new AlphaTabScoreAdapter(this.host().nativeElement, {
        fontDirectory: new URL('assets/alphatab/font/', this.document.baseURI).href,
      });
      this.controller = new ScoreController(this.adapter);
      this.unsubscribe = this.controller.subscribe((state) => {
        if (state.status === 'loading') this.adapter?.reset();
        this.state.set(state);
      });
      this.available.set(true);
    });
  }

  async openFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.controller) return;
    await this.controller.load({
      name: file.name,
      read: async () => {
        try { return new Uint8Array(await file.arrayBuffer()); }
        catch { throw new ScoreLoadError('read-failed'); }
      },
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.controller?.dispose();
    this.adapter?.destroy();
  }
}

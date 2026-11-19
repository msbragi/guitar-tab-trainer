import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import type { ScoreViewMode } from '@guitar-practice/alphatab-adapter';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScoreSession } from '../../score-session.js';
import { Icon } from '../../shared/icon/icon.js';
import { SongInfo } from '../song-info/song-info.js';

@Component({
  selector: 'gp-score-viewer', imports: [TranslocoPipe, Icon, SongInfo],
  templateUrl: './score-viewer.html',
  styleUrl: './score-viewer.css',
})
export class ScoreViewer {
  readonly session = inject(ScoreSession);
  readonly openTab = output<void>();
  readonly modes: readonly ScoreViewMode[] = ['score-tab', 'tab', 'notation'];
  readonly scales = [0.75, 1, 1.25, 1.5];
  readonly fullscreenAvailable = signal(false);
  readonly fullscreen = signal(false);
  readonly fullscreenError = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private readonly scoreHost = viewChild.required<ElementRef<HTMLElement>>('scoreHost');

  constructor() {
    afterNextRender(() => {
      const detach = this.session.attach(this.scoreHost().nativeElement);
      this.fullscreenAvailable.set(this.document.fullscreenEnabled);
      const update = () => this.fullscreen.set(this.document.fullscreenElement === this.host.nativeElement);
      this.document.addEventListener('fullscreenchange', update);
      this.destroy.onDestroy(() => { this.document.removeEventListener('fullscreenchange', update); detach(); });
    });
  }

  zoom(event: Event): void { void this.session.setView(this.session.mode(), Number((event.target as HTMLSelectElement).value)); }
  async toggleFullscreen(): Promise<void> {
    this.fullscreenError.set(false);
    try {
      if (this.fullscreen()) await this.document.exitFullscreen();
      else await this.host.nativeElement.requestFullscreen();
    } catch { this.fullscreenError.set(true); }
  }
}

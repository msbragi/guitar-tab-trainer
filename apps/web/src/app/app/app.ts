import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScoreSession } from '../score-session.js';
import { AppHeader } from '../layout/app-header/app-header.js';
import { LibraryPanel } from '../layout/library-panel/library-panel.js';
import { TracksPanel } from '../layout/tracks-panel/tracks-panel.js';
import { TransportBar } from '../layout/transport-bar/transport-bar.js';
import { SettingsPanel } from '../layout/settings-panel/settings-panel.js';
import type { Section } from '../layout/navigation.js';
import { ScoreViewer } from '../viewer/score-viewer/score-viewer.js';

@Component({
  selector: 'gp-app',
  imports: [TranslocoPipe, AppHeader, LibraryPanel, TracksPanel, TransportBar, SettingsPanel, ScoreViewer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly session = inject(ScoreSession);
  readonly section = signal<Section>('practice');
  readonly sidebarCollapsed = signal(false);
  readonly tracksCollapsed = signal(false);
  readonly tracks = computed(() => { const state = this.session.state(); return state.status === 'ready' ? state.score.tracks : []; });
  private readonly document = inject(DOCUMENT);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    afterNextRender(() => {
      this.sidebarCollapsed.set(this.document.defaultView?.matchMedia('(max-width: 1000px)').matches ?? false);
      this.tracksCollapsed.set(this.document.defaultView?.matchMedia('(max-width: 1100px)').matches ?? false);
    });
  }

  chooseFile(): void { this.section.set('practice'); this.fileInput().nativeElement.click(); }
  async openFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    this.section.set('practice');
    await this.session.open(file);
  }
}

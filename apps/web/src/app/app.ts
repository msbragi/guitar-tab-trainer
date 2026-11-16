import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScoreSession } from './score-session.js';
import { AppHeader } from './layout/app-header.js';
import { LibraryPanel } from './layout/library-panel.js';
import { TracksPanel } from './layout/tracks-panel.js';
import { TransportBar } from './layout/transport-bar.js';
import { SettingsPanel } from './layout/settings-panel.js';
import { sections } from './layout/navigation.js';
import type { Section } from './layout/navigation.js';
import { ScoreViewer } from './viewer/score-viewer.js';
import { Icon } from './shared/icon.js';

@Component({
  selector: 'gp-app',
  imports: [TranslocoPipe, AppHeader, LibraryPanel, TracksPanel, TransportBar, SettingsPanel, ScoreViewer, Icon],
  templateUrl: './app.html',
})
export class App {
  readonly session = inject(ScoreSession);
  readonly section = signal<Section>('practice');
  readonly sidebarCollapsed = signal(false);
  readonly tracksCollapsed = signal(false);
  readonly sectionIcon = computed(() => sections.find((item) => item.id === this.section())!.icon);
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

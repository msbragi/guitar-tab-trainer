import { Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScoreSession } from '../../score-session.js';
import { Icon } from '../../shared/icon/icon.js';

@Component({
  selector: 'gp-library-panel',
  imports: [TranslocoPipe, Icon],
  templateUrl: './library-panel.html',
  styleUrl: './library-panel.css',
})
export class LibraryPanel {
  readonly session = inject(ScoreSession);
  readonly collapsed = input(false);
  readonly busy = input(false);
  readonly toggle = output<void>();
  readonly openTab = output<void>();

  readonly importError = signal(false);
  private readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');

  readonly recentProjects = computed(() => this.session.projects());
  readonly favoriteProjects = computed(() => this.session.projects().filter((item) => item.favorite));
  readonly savedPhrases = computed(() => this.session.activeProject()?.phrases ?? []);
  readonly activeProjectId = computed(() => this.session.activeProject()?.id ?? null);

  triggerImport(): void {
    this.importInput()?.nativeElement.click();
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importError.set(false);
    try {
      const text = await file.text();
      await this.session.importProjectBundle(text);
    } catch {
      this.importError.set(true);
    }
  }
}

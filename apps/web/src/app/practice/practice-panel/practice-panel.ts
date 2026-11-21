import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { practiceRange } from '@guitar-practice/core';
import type { PracticeSelection } from '@guitar-practice/core';
import { ScoreSession } from '../../score-session.js';

@Component({
  selector: 'gp-practice-panel', imports: [TranslocoPipe],
  templateUrl: './practice-panel.html', styleUrl: './practice-panel.css',
})
export class PracticePanel {
  readonly session = inject(ScoreSession);
  readonly from = signal(0);
  readonly to = signal(0);
  readonly lead = signal(2);
  readonly countIn = signal(false);
  readonly flow = this.session.practiceFlow;
  readonly startOptions = computed(() => {
    const flow = this.flow();
    if (flow.phase !== 'configure') return [];
    return this.session.playbackBars().map((bar, index) => ({ ...bar, index })).filter((bar) => bar.barIndex === flow.startBar);
  });
  readonly endOptions = computed(() => {
    const flow = this.flow();
    if (flow.phase !== 'configure') return [];
    return this.session.playbackBars().map((bar, index) => ({ ...bar, index }))
      .filter((bar) => bar.barIndex === flow.endBar && bar.index >= this.from());
  });
  readonly draft = computed<PracticeSelection | null>(() => {
    const flow = this.flow();
    return flow.phase === 'configure' ? { trackIndex: flow.trackIndex, from: this.from(), to: this.to(),
      leadInBars: this.lead(), preparation: this.lead() > 0 ? 'context' : 'none', countIn: this.countIn() } : null;
  });
  readonly range = computed(() => {
    const draft = this.draft();
    return draft ? practiceRange(this.session.playbackBars(), draft) : null;
  });
  readonly trackName = computed(() => {
    const flow = this.flow(); const state = this.session.state();
    if ((flow.phase !== 'end' && flow.phase !== 'configure' && flow.phase !== 'active') || state.status !== 'ready') return '';
    return state.score.tracks.find(({ index }) => index === flow.trackIndex)?.name ?? '';
  });
  readonly summary = computed(() => {
    const flow = this.flow();
    return flow.phase === 'configure' || flow.phase === 'active' ? { from: flow.startBar + 1, to: flow.endBar + 1, track: this.trackName() } : null;
  });
  readonly ready = computed(() => !this.session.viewBusy() && ['stopped', 'paused', 'playing'].includes(this.session.transport().status));
  readonly variants = computed(() => this.session.activePhrase()?.variants ?? []);
  readonly activeVariantId = computed(() => this.session.activeVariant()?.id ?? null);

  constructor() {
    effect(() => {
      const options = this.startOptions();
      if (!options.length) return;
      const tick = untracked(() => this.session.transport().tick);
      const start = options.find((bar) => tick >= bar.startTick && tick < bar.endTick) ?? options[0]!;
      this.from.set(start.index);
      const flow = this.flow();
      const end = flow.phase === 'configure' ? this.session.playbackBars()
        .findIndex((bar, index) => index >= start.index && bar.barIndex === flow.endBar) : -1;
      this.to.set(end);
      this.lead.set(2); this.countIn.set(start.index === 0);
    });
  }
  chooseStart(index: number): void {
    this.from.set(index);
    this.to.set(this.endOptions()[0]?.index ?? -1);
    this.countIn.set(index === 0);
  }
  start(): void { const selection = this.draft(); if (selection) void this.session.startPractice(selection); }
}

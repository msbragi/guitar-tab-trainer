import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/icon/icon.js';
import { ScoreSession } from '../../score-session.js';

@Component({
  selector: 'gp-transport-bar', imports: [TranslocoPipe, Icon],
  templateUrl: './transport-bar.html',
  styleUrl: './transport-bar.css',
})
export class TransportBar {
  readonly session = inject(ScoreSession);
  readonly state = this.session.transport;
  readonly ready = computed(() => ['stopped', 'playing', 'paused'].includes(this.state().status)
    && (this.session.practiceFlow().phase === 'idle' || this.session.practiceFlow().phase === 'active') && !this.session.viewBusy());
  readonly practiceRange = computed(() => this.session.practiceFlow().phase === 'active' ? this.session.practiceRange() : null);
  readonly volumePercent = computed(() => Math.round(this.session.mixer().masterVolume * 100));
  readonly speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  time(ms: number): string {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  percent(tick: number | null): number { return Math.round((tick ?? 0) / (this.state().endTick || 1) * 100); }
}

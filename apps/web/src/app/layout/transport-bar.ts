import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../shared/icon.js';
import { ScoreSession } from '../score-session.js';

@Component({
  selector: 'gp-transport-bar', imports: [TranslocoPipe, Icon],
  template: `
    <footer class="transport-bar" [attr.aria-label]="'transport.title' | transloco"
      [attr.data-status]="state().status" [attr.data-tick]="state().tick"
      [attr.data-a]="state().a" [attr.data-b]="state().b" [attr.data-loop]="state().loop">
      <p class="transport-notice" [class.visually-hidden]="ready()">{{ ('transport.states.' + state().status) | transloco }}</p>
      @if (state().error) { <p class="transport-error" role="alert">{{ ('transport.errors.' + state().error) | transloco }}</p> }
      <fieldset [disabled]="!ready()">
        <legend class="visually-hidden">{{ 'transport.title' | transloco }}</legend>
        <div class="transport-buttons">
          <button class="round-button play-button" type="button" (click)="state().status === 'playing' ? session.pause() : session.play()"
            [title]="(state().status === 'playing' ? 'transport.pause' : 'transport.play') | transloco"
            [attr.aria-label]="(state().status === 'playing' ? 'transport.pause' : 'transport.play') | transloco">
            <gp-icon [name]="state().status === 'playing' ? 'pause' : 'play'" /></button>
          <button class="round-button" type="button" (click)="session.stop()" [title]="'transport.stop' | transloco"
            [attr.aria-label]="'transport.stop' | transloco"><gp-icon name="stop" /></button>
        </div>
        <div class="timeline"><span>{{ time(state().timeMs) }} / {{ time(state().durationMs) }}</span>
          <input #timeline type="range" min="0" [max]="state().endTick || 1" step="1" [value]="state().tick"
            (input)="session.seek(+timeline.value)" [title]="'transport.timeline' | transloco" [attr.aria-label]="'transport.timeline' | transloco"></div>
        <div class="loop-controls" aria-describedby="loop-help">
          <button class="control-button" type="button" (click)="session.toggleLoop()" [attr.aria-pressed]="state().loop"
            [title]="'transport.loop' | transloco" [attr.aria-label]="'transport.loop' | transloco"><gp-icon name="loop" /></button>
          <button class="control-button" type="button" (click)="session.setLoopPoint('a')" [title]="'transport.loopA' | transloco" [attr.aria-label]="'transport.loopA' | transloco">A</button>
          <button class="control-button" type="button" (click)="session.setLoopPoint('b')" [title]="'transport.loopB' | transloco" [attr.aria-label]="'transport.loopB' | transloco">B</button>
          <span class="loop-summary" [title]="'transport.loopHint' | transloco">A {{ percent(state().a) }}% · B {{ percent(state().b) }}%</span>
        </div>
        <label class="transport-field speed-field"><span>{{ 'transport.speed' | transloco }}</span>
          <select #speed [title]="'transport.speed' | transloco" [attr.aria-label]="'transport.speed' | transloco" [value]="state().speed" (change)="session.setSpeed(+speed.value)">
            @for (factor of speeds; track factor) { <option [value]="factor" [selected]="factor === state().speed">{{ factor * 100 }}%</option> }
          </select></label>
        <label class="transport-field tempo-field"><span>{{ 'transport.tempo' | transloco }}</span><input [attr.aria-label]="'transport.tempo' | transloco" readonly type="text" [title]="'transport.tempo' | transloco" [value]="state().tempo ? state().tempo.toFixed(0) : '—'" size="3"></label>
        <label class="transport-volume"><gp-icon name="volume" /><span class="visually-hidden">{{ 'transport.volume' | transloco }}</span>
          <input #master type="range" min="0" max="100" step="1" [value]="volumePercent()" [disabled]="!session.mixer().available"
            (input)="session.setMasterVolume(+master.value / 100)" [title]="'transport.volume' | transloco" [attr.aria-label]="'transport.volume' | transloco">
          <span class="master-volume-value">{{ volumePercent() }}%</span></label>
      </fieldset>
      <p id="loop-help" class="visually-hidden">{{ 'transport.loopHint' | transloco }} A {{ percent(state().a) }}% · B {{ percent(state().b) }}%</p>
    </footer>`,
})
export class TransportBar {
  readonly session = inject(ScoreSession);
  readonly state = this.session.transport;
  readonly ready = computed(() => ['stopped', 'playing', 'paused'].includes(this.state().status));
  readonly volumePercent = computed(() => Math.round(this.session.mixer().masterVolume * 100));
  readonly speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  time(ms: number): string {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  percent(tick: number | null): number { return Math.round((tick ?? 0) / (this.state().endTick || 1) * 100); }
}

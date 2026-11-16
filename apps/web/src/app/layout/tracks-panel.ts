import { Component, input, output } from '@angular/core';
import { initialMixerState } from '@guitar-practice/core';
import type { MixerState, ScoreSummary } from '@guitar-practice/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../shared/icon.js';

@Component({
  selector: 'gp-tracks-panel', imports: [TranslocoPipe, Icon],
  template: `
    <aside class="side-panel tracks-panel" [class.collapsed]="collapsed()" [attr.aria-label]="'shell.tracksPanel' | transloco">
      <div class="panel-top"><h3><gp-icon name="tracks" /><span>{{ 'score.trackList' | transloco }}</span></h3>
        <button class="icon-button" type="button" [attr.aria-label]="(collapsed() ? 'shell.expandTracks' : 'shell.collapseTracks') | transloco"
          [title]="(collapsed() ? 'shell.expandTracks' : 'shell.collapseTracks') | transloco"
          [attr.aria-expanded]="!collapsed()" aria-controls="tracks-panel-content" (click)="toggle.emit()"><gp-icon [name]="collapsed() ? 'left' : 'right'" /></button></div>
      <div id="tracks-panel-content" [hidden]="collapsed()">
        @if (mixer().error) { <p class="error" role="alert">{{ ('mixer.errors.' + mixer().error) | transloco }}</p> }
        @if (tracks().length) {
          <ul class="track-list" [attr.aria-label]="'score.trackList' | transloco">
            @for (track of tracks(); track track.index) {
              @let mix = trackState(track.index);
              <li class="track-card" [attr.data-track]="track.index" [class.track-excluded]="mix?.excluded">
                <div class="track-title"><gp-icon name="music" /><span class="track-number">{{ track.index + 1 }}.</span><span class="track-name">{{ track.name }}</span></div>
                <fieldset class="track-controls" [disabled]="!mixer().available || !mix">
                  <legend class="visually-hidden">{{ 'mixer.trackControls' | transloco: { name: track.name } }}</legend>
                  <button type="button" (click)="mute.emit(track.index)" [attr.aria-pressed]="mix?.muted ?? false"
                    [attr.aria-label]="(mix?.muted ? 'mixer.unmute' : 'shell.mute') | transloco: { name: track.name }"
                    [title]="(mix?.muted ? 'mixer.unmute' : 'shell.mute') | transloco: { name: track.name }">M</button>
                  <button type="button" (click)="solo.emit(track.index)" [attr.aria-pressed]="mix?.solo ?? false"
                    [attr.aria-label]="(mix?.solo ? 'mixer.unsolo' : 'shell.solo') | transloco: { name: track.name }"
                    [title]="(mix?.solo ? 'mixer.unsolo' : 'shell.solo') | transloco: { name: track.name }">S</button>
                  <input #volume type="range" min="0" max="100" step="1" [value]="percent(mix?.volume ?? 1)"
                    (input)="volumeChange.emit({ index: track.index, volume: +volume.value / 100 })"
                    [attr.aria-label]="'shell.trackVolume' | transloco: { name: track.name }" [title]="'shell.trackVolume' | transloco: { name: track.name }">
                  <span class="track-volume-value">{{ percent(mix?.volume ?? 1) }}%</span>
                </fieldset>
                @if (mix?.excluded) { <p class="track-status">{{ 'mixer.excluded' | transloco }}</p> }
                @if (mix && mix.linkedTrackIndexes.length > 1) { <p class="track-status">{{ 'mixer.linked' | transloco }}</p> }
              </li>
            }
          </ul>
          <p class="panel-hint">{{ (mixer().available ? 'mixer.hint' : 'mixer.waiting') | transloco }}</p>
        } @else { <p class="empty-panel">{{ 'shell.noTracks' | transloco }}</p> }
      </div>
    </aside>`,
})
export class TracksPanel {
  readonly tracks = input<ScoreSummary['tracks']>([]);
  readonly mixer = input<MixerState>(initialMixerState());
  readonly collapsed = input(false);
  readonly toggle = output<void>();
  readonly mute = output<number>();
  readonly solo = output<number>();
  readonly volumeChange = output<{ index: number; volume: number }>();
  trackState(index: number) { return this.mixer().tracks.find((track) => track.index === index); }
  percent(value: number): number { return Math.round(value * 100); }
}

import { Component, input, output } from '@angular/core';
import type { ScoreSummary } from '@guitar-practice/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../shared/icon.js';

@Component({
  selector: 'gp-tracks-panel', imports: [TranslocoPipe, Icon],
  template: `
    <aside class="side-panel tracks-panel" [class.collapsed]="collapsed()" [attr.aria-label]="'shell.tracksPanel' | transloco">
      <div class="panel-top"><h3><gp-icon name="tracks" /><span>{{ 'score.trackList' | transloco }}</span></h3>
        <button class="icon-button" type="button" [attr.aria-label]="(collapsed() ? 'shell.expandTracks' : 'shell.collapseTracks') | transloco"
          [attr.aria-expanded]="!collapsed()" aria-controls="tracks-panel-content" (click)="toggle.emit()"><gp-icon [name]="collapsed() ? 'left' : 'right'" /></button></div>
      <div id="tracks-panel-content" [hidden]="collapsed()">
        @if (tracks().length) {
          <ul class="track-list" [attr.aria-label]="'score.trackList' | transloco">
            @for (track of tracks(); track track.index) {
              <li class="track-card"><div class="track-title"><gp-icon name="music" /><span class="track-number">{{ track.index + 1 }}.</span><span class="track-name">{{ track.name }}</span></div>
                <div class="track-controls">
                  <button type="button" disabled [attr.aria-label]="'shell.mute' | transloco: { name: track.name }">M</button>
                  <button type="button" disabled [attr.aria-label]="'shell.solo' | transloco: { name: track.name }">S</button>
                  <input type="range" min="0" max="100" value="100" disabled [attr.aria-label]="'shell.trackVolume' | transloco: { name: track.name }">
                </div>
              </li>
            }
          </ul>
          <p class="panel-hint">{{ 'shell.mixerUnavailable' | transloco }}</p>
        } @else { <p class="empty-panel">{{ 'shell.noTracks' | transloco }}</p> }
      </div>
    </aside>`,
})
export class TracksPanel {
  readonly tracks = input<ScoreSummary['tracks']>([]);
  readonly collapsed = input(false);
  readonly toggle = output<void>();
}

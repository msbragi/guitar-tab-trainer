import { Component, input, output } from '@angular/core';
import { initialMixerState } from '@guitar-practice/core';
import type { MixerState, ScoreSummary } from '@guitar-practice/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SongInfo } from '../../viewer/song-info/song-info.js';
import type { ScoreState } from '@guitar-practice/core';
import { Icon } from '../../shared/icon/icon.js';

@Component({
  selector: 'gp-tracks-panel', imports: [TranslocoPipe, Icon, SongInfo],
  templateUrl: './tracks-panel.html',
  styleUrl: './tracks-panel.css',
})
export class TracksPanel {
  readonly scoreState = input<ScoreState>({ status: 'idle' });
  readonly tracks = input<ScoreSummary['tracks']>([]);
  readonly mixer = input<MixerState>(initialMixerState());
  readonly collapsed = input(false);
  readonly hiddenTracks = input<readonly number[]>([]);
  readonly viewBusy = input(false);
  readonly visibility = output<number>();
  readonly reset = output<void>();
  readonly toggle = output<void>();
  readonly mute = output<number>();
  readonly solo = output<number>();
  readonly volumeChange = output<{ index: number; volume: number }>();
  trackState(index: number) { return this.mixer().tracks.find((track) => track.index === index); }
  percent(value: number): number { return Math.round(value * 100); }
}

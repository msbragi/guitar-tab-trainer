import { Component, input } from '@angular/core';
import type { ScoreState } from '@guitar-practice/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/icon/icon.js';

@Component({
  selector: 'gp-song-info', imports: [TranslocoPipe, Icon],
  templateUrl: './song-info.html',
  styleUrl: './song-info.css',
})
export class SongInfo { readonly state = input<ScoreState>({ status: 'idle' }); }

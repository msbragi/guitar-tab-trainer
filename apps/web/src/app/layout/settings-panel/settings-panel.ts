import { Component, computed, ElementRef, inject, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { GM_GUITAR_PROGRAMS } from '../../projects/sf2-presets.js';
import { ScoreSession } from '../../score-session.js';
import { ThemeService } from '../../theme/theme.service.js';
import { Icon } from '../../shared/icon/icon.js';

@Component({
  selector: 'gp-settings-panel',
  imports: [TranslocoPipe, Icon],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.css',
})
export class SettingsPanel {
  readonly theme = inject(ThemeService);
  readonly session = inject(ScoreSession);
  readonly close = output<void>();

  readonly guitarPrograms = GM_GUITAR_PROGRAMS;

  readonly tracksByProgram = computed(() => {
    const state = this.session.state();
    const map = new Map<number, string[]>();
    if (state.status !== 'ready') return map;
    for (const track of state.score.tracks) {
      for (const prog of track.programs ?? []) {
        const list = map.get(prog) ?? [];
        const label = track.name || `#${track.index + 1}`;
        if (!list.includes(label)) list.push(label);
        map.set(prog, list);
      }
    }
    return map;
  });

  private readonly baseInput = viewChild<ElementRef<HTMLInputElement>>('baseSf2Input');
  private readonly guitarInput = viewChild<ElementRef<HTMLInputElement>>('guitarSf2Input');

  selectTheme(event: Event): void {
    this.theme.select((event.target as HTMLSelectElement).value);
  }

  chooseBaseSoundFont(): void {
    this.baseInput()?.nativeElement.click();
  }

  chooseGuitarSoundFont(): void {
    this.guitarInput()?.nativeElement.click();
  }

  onBaseSoundFontSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.session.setCustomSoundFont('base', file);
  }

  onGuitarSoundFontSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.session.setCustomSoundFont('guitar', file);
  }

  resetBaseSoundFont(): void {
    void this.session.clearCustomSoundFont('base');
  }

  clearGuitarSoundFont(): void {
    void this.session.clearCustomSoundFont('guitar');
  }

  onGuitarMapChange(gmProgram: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const presetIndex = value === '' ? null : Number(value);
    void this.session.setGuitarProgramMapping(gmProgram, presetIndex);
  }

  mappedPresetValue(gmProgram: number): string {
    const val = this.session.guitarProgramMap()[gmProgram];
    return typeof val === 'number' ? String(val) : '';
  }

  trackLabelFor(gmProgram: number): string {
    const tracks = this.tracksByProgram().get(gmProgram);
    return tracks?.length ? tracks.join(', ') : '';
  }
}

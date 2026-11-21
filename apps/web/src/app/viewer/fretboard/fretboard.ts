import { Component, computed, inject, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { FretboardEffect } from '@guitar-practice/alphatab-adapter';
import { drawFretboardGestures, fretCellWidth, fretHeaderHeight, fretRowHeight } from './gesture-drawing.js';
import { ScoreSession } from '../../score-session.js';

const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

@Component({
  selector: 'gp-fretboard',
  imports: [TranslocoPipe],
  templateUrl: './fretboard.html',
  styleUrl: './fretboard.css',
})
export class Fretboard {
  readonly session = inject(ScoreSession);
  readonly requestedTrack = model<number | null>(null);
  readonly tracks = computed(() => {
    const state = this.session.state();
    return state.status === 'ready' ? state.score.tracks : [];
  });
  readonly selectedTrack = computed(() => {
    const tracks = this.tracks();
    return tracks.find(({ index }) => index === this.requestedTrack())?.index ?? tracks[0]?.index;
  });
  readonly frame = computed(() => {
    const index = this.selectedTrack();
    return index === undefined ? null : this.session.fretboardFor(index);
  });
  readonly isVariantView = computed(() => {
    const index = this.selectedTrack();
    const practice = this.session.practice();
    return this.session.activeVariant() !== null && practice !== null && index === practice.trackIndex;
  });
  readonly canEditVariant = computed(() => {
    const index = this.selectedTrack();
    return index !== undefined && this.session.canEditFretboardVariant(index);
  });
  readonly variantNotes = computed(() => {
    const index = this.selectedTrack();
    return index === undefined ? [] : this.session.variantNotesAtCurrentTick(index);
  });
  readonly variantByCell = computed(
    () => new Map(this.variantNotes().map((note) => [`${note.string}:${note.fret}`, note])),
  );
  readonly frets = computed(() => {
    const positions = this.frame()?.positions ?? [];
    const destinations = positions.flatMap(({ gestures }) =>
      (gestures ?? []).flatMap((gesture) => {
        if (gesture.kind === 'bend') return [];
        return gesture.kind === 'slide' ? [gesture.targetFret] : [gesture.sourceFret, gesture.targetFret];
      }));
    const count = Math.max(24, ...positions.map(({ fret }) => fret), ...destinations);
    return Array.from({ length: count + 1 }, (_, fret) => fret);
  });
  readonly drawings = computed(() => drawFretboardGestures(this.frame()));
  readonly boardWidth = computed(() => (this.frets().length + 1) * fretCellWidth);
  readonly boardHeight = computed(() => fretHeaderHeight + (this.frame()?.tuning.length ?? 0) * fretRowHeight);
  readonly referenceFrets = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);
  readonly active = computed(() => new Set(this.frame()?.positions.map(({ string, fret }) => `${string}:${fret}`)));

  readonly effectsByPosition = computed(() => new Map(
    this.frame()?.positions.map(({ string, fret, effects }) => [`${string}:${fret}`, effects ?? []]) ?? [],
  ));
  readonly effectPositions = computed(() => this.frame()?.positions.filter(({ effects }) => effects?.length) ?? []);

  effectSymbol(effect: FretboardEffect): string {
    if (effect.kind === 'bend') {
      const rises = effect.tones.some((tone, index) => index > 0 && tone > effect.tones[index - 1]!);
      const falls = effect.tones.some((tone, index) => index > 0 && tone < effect.tones[index - 1]!);
      if (rises && falls) return '↕';
      return falls ? '↓' : '↑';
    }
    if (effect.kind === 'vibrato') return '≈';
    if (effect.kind === 'slide') {
      return effect.direction === 'up' ? '↗' : effect.direction === 'down' ? '↘' : '→';
    }
    return effect.kind === 'hammer-on' ? 'H' : 'P';
  }

  pitchClass(midi: number): number {
    return (midi % 12 + 12) % 12;
  }

  onCellClick(variantString: number, fret: number): void {
    if (!this.canEditVariant()) return;
    void this.session.editVariantNoteOnFretboard(variantString, fret, this.frame()?.tuning);
  }

  pitchName(midi: number): string {
    return pitchNames[(midi % 12 + 12) % 12] + String(Math.floor(midi / 12) - 1);
  }
}

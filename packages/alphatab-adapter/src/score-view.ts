import type { model } from '@coderline/alphatab/core';

import type { ScoreViewMode } from './view-mode.js';

/** Proprietà pubbliche Staff, preferite al deprecato display.staveProfile. */
export function applyScoreView(score: model.Score, mode: ScoreViewMode): void {
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      staff.showTablature = mode !== 'notation' && staff.isStringed;
      // Una traccia priva di corde non ha una tablatura: resta leggibile in notazione.
      staff.showStandardNotation = mode !== 'tab' || !staff.isStringed;
      staff.showSlash = false;
      staff.showNumbered = false;
    }
  }
}

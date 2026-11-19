import type { MixerController, MixerState, TransportController, TransportState } from '@guitar-practice/core';
import type { SessionPreferences } from './session-preferences.js';

export interface SavedTransport {
  readonly tick: number;
  readonly speed: number;
  readonly a: number | null;
  readonly b: number | null;
  readonly loop: boolean;
}
export interface SavedMixer {
  readonly masterVolume: number;
  readonly tracks: readonly { readonly index: number; readonly muted: boolean; readonly solo: boolean; readonly volume: number }[];
}
export interface CurrentSessionState {
  readonly view: Pick<SessionPreferences, 'mode' | 'scale'> & { readonly hiddenTracks?: readonly number[] };
  readonly transport: SavedTransport;
  readonly mixer: SavedMixer;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const volume = (value: unknown): value is number => number(value) && value >= 0 && value <= 1;

/** I dati dello storage non sono attendibili; la durata e gli indici effettivi si verificano sui controller. */
export function parseCurrentSessionState(value: unknown): CurrentSessionState | null {
  if (!object(value)) return null;
  const { view, transport, mixer } = value;
  if (!object(view) || !['score-tab', 'tab', 'notation'].includes(String(view['mode']))
    || ![0.75, 1, 1.25, 1.5].includes(view['scale'] as number)) return null;
  const hiddenTracks = view['hiddenTracks'];
  if (hiddenTracks !== undefined && (!Array.isArray(hiddenTracks)
    || hiddenTracks.some((index: unknown) => !number(index) || !Number.isInteger(index) || index < 0))) return null;
  if (!object(transport) || !number(transport['tick']) || transport['tick'] < 0
    || ![0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].includes(transport['speed'] as number)
    || typeof transport['loop'] !== 'boolean') return null;
  const { a, b } = transport;
  if (!(a === null && b === null && !transport['loop'])
    && !(number(a) && number(b) && a >= 0 && a < b)) return null;
  if (!object(mixer) || !volume(mixer['masterVolume']) || !Array.isArray(mixer['tracks'])) return null;
  const indexes = new Set<number>();
  for (const track of mixer['tracks']) {
    if (!object(track) || !number(track['index']) || !Number.isInteger(track['index']) || track['index'] < 0
      || indexes.has(track['index']) || typeof track['muted'] !== 'boolean' || typeof track['solo'] !== 'boolean'
      || !volume(track['volume'])) return null;
    indexes.add(track['index']);
  }
  return value as unknown as CurrentSessionState;
}

export function captureCurrentSessionState(view: CurrentSessionState['view'], transport: TransportState, mixer: MixerState): CurrentSessionState {
  return {
    view: { ...view, ...(view.hiddenTracks ? { hiddenTracks: [...view.hiddenTracks] } : {}) },
    transport: { tick: transport.tick, speed: transport.speed, a: transport.a, b: transport.b, loop: transport.loop },
    mixer: { masterVolume: mixer.masterVolume, tracks: mixer.tracks.map(({ index, muted, solo, volume }) => ({ index, muted, solo, volume })) },
  };
}

export function restoreTransport(controller: TransportController, saved: SavedTransport): void {
  controller.setSpeed(saved.speed);
  const { a, b } = saved;
  // Un range non più compatibile col documento viene ignorato; seek resta limitato dal core.
  if (a !== null && b !== null && a >= 0 && a < b && b <= controller.state.endTick) {
    controller.setPoint('a', a);
    controller.setPoint('b', b);
    if (saved.loop !== controller.state.loop) controller.toggleLoop();
  }
  controller.seek(saved.tick);
}

export function restoreMixer(controller: MixerController, saved: SavedMixer): void {
  controller.setMasterVolume(saved.masterVolume);
  for (const track of saved.tracks) {
    const current = controller.state.tracks.find((item) => item.index === track.index);
    if (!current) continue;
    if (current.muted !== track.muted) controller.toggleMute(track.index);
    if (current.solo !== track.solo) controller.toggleSolo(track.index);
    controller.setVolume(track.index, track.volume);
  }
}

import { AlphaTabApi, PlayerMode, synth } from '@coderline/alphatab';
import type { model } from '@coderline/alphatab';
import type { ScoreLoader, ScoreSummary, TransportEvent, TransportPort, MixerPort, MixerEvent } from '@guitar-practice/core';
import { ScoreLoadError } from '@guitar-practice/core';
import { parseScore } from './parse-score.js';
import { applyScoreView } from './score-view.js';
import type { ScoreViewMode } from './view-mode.js';
import { configureAudioRuntime } from './browser-audio-runtime.js';
import { readFretboard } from './fretboard.js';
import type { FretboardFrame } from './fretboard-frame.js';
import { describeMixerTracks } from './mixer-tracks.js';
import { readPlaybackBars } from './playback-bars.js';
import type { PracticeBarPick } from '@guitar-practice/core';

export interface AlphaTabViewOptions {
  readonly fontDirectory: string;
  readonly audio?: { readonly scriptFile: string; readonly soundFont: string; readonly scrollElement: HTMLElement };
}

/** Adapter browser: eventi del motore convertiti nel port del core, senza stato UI. */
export class AlphaTabScoreAdapter implements ScoreLoader, TransportPort, MixerPort {
  private api: AlphaTabApi | undefined;
  private cancel: (() => void) | undefined;
  private destroyed = false;
  private generation = 0;
  private mode: ScoreViewMode = 'score-tab';
  private scale = 1;
  private readonly transportListeners = new Set<(event: TransportEvent) => void>();
  private audioCleanup: (() => void) | undefined;
  private runtimeCleanup: (() => void) | undefined;
  private readonly mixerListeners = new Set<(event: MixerEvent) => void>();
  private practicePick: ((pick: PracticeBarPick) => void) | undefined;
  private practiceTicks: { readonly startTick: number; readonly endTick: number } | null = null;
  private practiceHighlight: { readonly trackIndex: number; readonly startBar: number; readonly endBar: number } | null = null;

  constructor(private readonly host: HTMLElement, private readonly options: AlphaTabViewOptions) {}

  fretboardAt(trackIndex: number, tick: number): FretboardFrame | null {
    return this.api ? readFretboard(this.api, trackIndex, tick) : null;
  }

  playbackBars() { return this.api ? readPlaybackBars(this.api) : []; }

  setPracticePicking(listener: ((pick: PracticeBarPick) => void) | null): void { this.practicePick = listener ?? undefined; }

  setPracticeTicks(range: { readonly startTick: number; readonly endTick: number } | null): void { this.practiceTicks = range; }

  highlightPractice(trackIndex: number, startBar: number, endBar: number): void {
    this.practiceHighlight = { trackIndex, startBar, endBar };
    this.applyPracticeHighlight();
  }

  private applyPracticeHighlight(): void {
    if (!this.practiceHighlight) return;
    const { trackIndex, startBar, endBar } = this.practiceHighlight;
    const api = this.api;
    const staff = api?.score?.tracks.find(({ index }) => index === trackIndex)?.staves[0];
    const first = staff?.bars[startBar]?.voices[0]?.beats[0];
    const last = staff?.bars[endBar]?.voices[0]?.beats.at(-1);
    if (first && last) api!.highlightPlaybackRange(first, last);
  }

  clearPracticeHighlight(): void { this.practiceHighlight = null; this.api?.clearPlaybackRangeHighlight(); }

  /** Crop the rendered score only; retain the same musical model, MIDI and player. */
  async setPracticeView(range: { readonly startBar: number; readonly endBar: number } | null): Promise<void> {
    const api = this.api;
    if (!api?.score || this.destroyed) throw new ScoreLoadError('session-closed');
    if (this.cancel) throw new ScoreLoadError('busy');
    const previous = { startBar: api.settings.display.startBar, barCount: api.settings.display.barCount };
    api.settings.display.startBar = range ? range.startBar + 1 : 1;
    api.settings.display.barCount = range ? range.endBar - range.startBar + 1 : -1;
    try {
      api.updateSettings();
      await this.render(api, () => api.render());
    } catch (error: unknown) {
      Object.assign(api.settings.display, previous); api.updateSettings();
      throw error;
    }
  }

  async load(bytes: Uint8Array): Promise<ScoreSummary> {
    if (this.destroyed) throw new ScoreLoadError('session-closed');
    if (this.cancel) throw new ScoreLoadError('busy');
    this.reset();
    const generation = this.generation;
    const { score, summary } = parseScore(bytes);
    try {
      const api = new AlphaTabApi(this.host, {
        core: {
          fontDirectory: this.options.fontDirectory,
          useWorkers: false,
          enableLazyLoading: false,
        },
        player: { enablePlayer: false },
        display: { scale: this.scale },
      });
      this.api = api;
      applyScoreView(score, this.mode);
      await this.render(api, () => api.renderScore(score, score.tracks.map((track) => track.index)));
      if (this.options.audio) this.prepareAudio(api);
      return summary;
    } catch (error: unknown) {
      if (generation === this.generation) this.reset();
      throw error;
    }
  }

  subscribeTransport(listener: (event: TransportEvent) => void): () => void {
    this.transportListeners.add(listener);
    return () => { this.transportListeners.delete(listener); };
  }

  play(): boolean { return this.api?.play() ?? false; }
  pause(): void { this.api?.pause(); }
  stop(): void { this.api?.stop(); }
  seek(tick: number): void { if (this.api) this.api.tickPosition = tick; }
  setSpeed(factor: number): void { if (this.api) this.api.playbackSpeed = factor; }
  setPlaybackRange(range: { readonly startTick: number; readonly endTick: number } | null, tick: number, looping = true): void {
    if (!this.api) return;
    // Le richieste al worker sono ordinate: range prima, poi posizione da conservare.
    this.api.isLooping = range !== null && looping;
    this.api.playbackRange = range;
    this.api.tickPosition = tick;
    this.applyPracticeHighlight();
  }

  private emit(event: TransportEvent): void {
    this.transportListeners.forEach((listener) => listener(event));
  }

  subscribeMixer(listener: (event: MixerEvent) => void): () => void {
    this.mixerListeners.add(listener);
    return () => { this.mixerListeners.delete(listener); };
  }
  setTrackMute(indexes: readonly number[], muted: boolean): void {
    const { api, tracks } = this.mixerTracks(indexes); api.changeTrackMute(tracks, muted);
  }
  setTrackSolo(indexes: readonly number[], solo: boolean): void {
    const { api, tracks } = this.mixerTracks(indexes); api.changeTrackSolo(tracks, solo);
  }
  setTrackVolume(indexes: readonly number[], volume: number): void {
    const { api, tracks } = this.mixerTracks(indexes); api.changeTrackVolume(tracks, volume);
  }
  setMasterVolume(volume: number): void {
    if (!this.api?.isReadyForPlayback) throw new Error('audio-unavailable');
    this.api.masterVolume = volume;
  }
  private mixerTracks(indexes: readonly number[]) {
    const api = this.api;
    if (!api?.score || !api.isReadyForPlayback) throw new Error('audio-unavailable');
    const tracks = indexes.map((index) => {
      const track = api.score!.tracks.find((track) => track.index === index);
      if (!track) throw new Error('invalid-track');
      return track;
    });
    return { api, tracks };
  }
  private emitMixer(event: MixerEvent): void { this.mixerListeners.forEach((listener) => listener(event)); }

  private prepareAudio(api: AlphaTabApi): void {
    const audio = this.options.audio!;
    this.emit({ type: 'preparing' });
    const generation = this.generation;
    const active = () => this.api === api && generation === this.generation && !this.destroyed;
    let scrollFrame: number | undefined;
    const position = (event: { currentTick: number; endTick: number; currentTime: number; endTime: number; modifiedTempo: number; isSeek: boolean }) => {
      if (active()) this.emit({ type: 'position', isSeek: event.isSeek, position: { tick: event.currentTick, endTick: event.endTick,
        timeMs: event.currentTime, durationMs: event.endTime, tempo: event.modifiedTempo } });
      // alphaTab accoda due passaggi visivi: scorrere dopo il posizionamento del cursore.
      if (active() && event.isSeek) {
        if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = requestAnimationFrame(() => {
            scrollFrame = undefined;
            if (active()) api.scrollToCursor();
          });
        });
      }
    };
    const seekToBeat = (beat: model.Beat) => {
      if (!active() || !api.tickCache) return;
      if (this.practicePick) {
        this.practicePick({ trackIndex: beat.voice.bar.staff.track.index, barIndex: beat.voice.bar.index });
        return;
      }
      let tick = api.tickCache.getBeatStart(beat);
      if (this.practiceTicks) {
        const occurrences = api.tickCache.masterBars.filter(({ masterBar, start, end }) =>
          masterBar.index === beat.voice.bar.index && start >= this.practiceTicks!.startTick && end <= this.practiceTicks!.endTick);
        const occurrence = occurrences.find(({ start, end }) => api.tickPosition >= start && api.tickPosition < end) ?? occurrences[0];
        const relative = api.tickCache.getRelativeBeatPlaybackRange(beat);
        if (!occurrence || !relative) return;
        tick = occurrence.start + relative.startTick;
      }
      this.emit({ type: 'seek-request', tick });
    };
    const ready = () => {
      if (!active()) return;
      clearTimeout(timeout);
      position({ currentTick: api.tickPosition, endTick: api.endTick, currentTime: api.timePosition,
        endTime: api.endTime, modifiedTempo: api.player?.currentPosition.modifiedTempo ?? 0, isSeek: true });
      this.emit({ type: 'ready' });
      this.emitMixer({ type: 'ready', tracks: describeMixerTracks(api.score?.tracks ?? []) });
    };
    const state = (event: { state: synth.PlayerState; stopped: boolean }) => {
      if (active()) this.emit({ type: 'state', status: event.state === synth.PlayerState.Playing ? 'playing'
        : event.stopped ? 'stopped' : 'paused' });
    };
    const failed = () => {
      if (!active()) return;
      clearTimeout(timeout);
      api.stop();
      api.player?.output?.destroy();
      this.runtimeCleanup?.();
      this.emit({ type: 'error', error: 'audio-unavailable' });
      this.emitMixer({ type: 'unavailable' });
    };
    const timeout = setTimeout(() => {
      if (active()) {
        api.stop(); api.player?.output?.destroy(); this.runtimeCleanup?.();
        this.emit({ type: 'error', error: 'prepare-timeout' });
        this.emitMixer({ type: 'unavailable' });
      }
    }, 30_000);
    this.audioCleanup = () => {
      clearTimeout(timeout);
      if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
      api.beatMouseDown.off(seekToBeat);
      api.playerReady.off(ready); api.playerPositionChanged.off(position);
      api.playerStateChanged.off(state); api.error.off(failed);
    };
    api.beatMouseDown.on(seekToBeat);
    api.playerPositionChanged.on(position); api.playerStateChanged.on(state);
    api.playerReady.on(ready); api.error.on(failed);
    try {
      this.runtimeCleanup = configureAudioRuntime((settings) => { if (settings === api.settings) failed(); });
      api.settings.core.scriptFile = audio.scriptFile;
      api.settings.player.soundFont = audio.soundFont;
      api.settings.player.scrollElement = audio.scrollElement;
      api.settings.player.enableSeekToClick = false;
      api.settings.player.enablePlaybackRangeSelection = false;
      api.settings.player.resetPlaybackRangeOnClick = false;
      api.settings.player.playerMode = PlayerMode.EnabledSynthesizer;
      api.updateSettings();
      if (api.isReadyForPlayback) ready();
    } catch { failed(); }
  }

  async setVisibleTracks(indexes: readonly number[]): Promise<void> {
    const api = this.api;
    if (!api?.score || this.destroyed) return;
    if (this.cancel) throw new ScoreLoadError('busy');
    const tracks = api.score.tracks.filter(({ index }) => indexes.includes(index));
    if (!tracks.length) return;
    await this.render(api, () => api.renderTracks(tracks));
  }

  /** Cambia soltanto la presentazione della copia in memoria, senza riscrivere il file. */
  async setView(mode: ScoreViewMode, scale: number): Promise<void> {
    if (this.destroyed) throw new ScoreLoadError('session-closed');
    if (this.cancel) throw new ScoreLoadError('busy');
    const api = this.api;
    if (!api?.score) return;
    this.mode = mode;
    this.scale = Math.max(0.5, Math.min(1.5, scale));
    applyScoreView(api.score, mode);
    api.settings.display.scale = this.scale;
    api.updateSettings();
    await this.render(api, () => api.render());
  }

  private render(api: AlphaTabApi, action: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          api.postRenderFinished.off(done);
          api.error.off(failed);
          this.cancel = undefined;
        };
        const done = () => { cleanup(); this.applyPracticeHighlight(); resolve(); };
        const failed = () => { cleanup(); reject(new ScoreLoadError('render-failed')); };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new ScoreLoadError('render-timeout'));
        }, 30_000);
        this.cancel = () => { cleanup(); reject(new ScoreLoadError('cancelled')); };
        api.postRenderFinished.on(done);
        api.error.on(failed);
        try {
          action();
        } catch {
          failed();
        }
      });
  }

  destroy(): void {
    this.destroyed = true;
    this.reset();
    this.transportListeners.clear();
    this.mixerListeners.clear();
  }

  /** Rimuove la vista precedente anche se la lettura del prossimo file fallisce. */
  reset(): void {
    this.generation++;
    this.practicePick = undefined; this.practiceTicks = null; this.practiceHighlight = null;
    this.cancel?.();
    this.audioCleanup?.();
    this.audioCleanup = undefined;
    const output = this.api?.player?.output;
    this.api?.destroy();
    // API pubbliche: il cleanup non dipende dall'ack di un worker non inizializzato o guasto.
    output?.destroy();
    this.runtimeCleanup?.();
    this.runtimeCleanup = undefined;
    this.api = undefined;
    this.host.replaceChildren();
    this.emit({ type: 'reset' });
    this.emitMixer({ type: 'reset' });
  }
}

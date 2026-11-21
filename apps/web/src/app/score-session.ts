import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ScoreController, ScoreLoadError, TransportController, initialTransportState, MixerController, initialMixerState } from '@guitar-practice/core';
import type { ScoreErrorCode, ScoreState, TransportState, MixerState, ScoreSource } from '@guitar-practice/core';
import { AlphaTabScoreAdapter } from '@guitar-practice/alphatab-adapter';
import { readSessionPreferences, writeSessionPreferences } from './session-preferences.js';
import type { SessionPreferences } from './session-preferences.js';
import { CurrentSessionStore } from './current-session-store.js';
import type { CurrentSessionFile } from './current-session-store.js';
import { captureCurrentSessionState, restoreMixer, restoreTransport } from './current-session-state.js';
import type { CurrentSessionState, SavedTransport, SavedMixer } from './current-session-state.js';
import type { ScoreViewMode } from '@guitar-practice/alphatab-adapter';
import { pickPracticeBar, practiceRange } from '@guitar-practice/core';
import type { PlaybackBar, PracticeSelection, PracticeFlow, PracticeBarPick } from '@guitar-practice/core';
import {
  computeScoreContentId,
  createVariantEditor,
  exportPortableProjectBundle,
  formatDefaultPhraseName,
  importPortableProjectBundle,
  redoVariantEdit as applyRedoVariantEdit,
  removeVariantNote,
  undoVariantEdit as applyUndoVariantEdit,
  upsertVariantNoteOnFretboard,
  type PhraseVariant,
  type PracticePhrase,
  type StudyProject,
  type StudyProjectSummary,
  type VariantEditorState,
  type VariantMediaPayload,
  type VariantNote,
} from '@guitar-practice/study-project';
import { CountIn } from './practice/count-in.js';
import { GuitarCapture, initialGuitarCaptureStatus, type GuitarCaptureStatus } from './practice/guitar-capture.js';
import { IndexedDbStudyProjectStore } from './projects/indexeddb-project-store.js';

/** Composizione UI di core e adapter. I componenti presentano dati e inoltrano comandi. */
@Injectable({ providedIn: 'root' })
export class ScoreSession {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<ScoreState>({ status: 'idle' });
  readonly state = this.current.asReadonly();
  readonly available = signal(false);
  private readonly hidden = signal<readonly number[]>([]);
  readonly hiddenTracks = this.hidden.asReadonly();
  readonly viewBusy = signal(false);
  readonly viewError = signal<ScoreErrorCode | null>(null);
  readonly mode = signal<ScoreViewMode>('score-tab');
  readonly scale = signal(1);
  private readonly transportSnapshot = signal<TransportState>(initialTransportState());
  /** Proiezione dello stato del core; nessuna transizione del trasporto nella UI. */
  readonly transport = this.transportSnapshot.asReadonly();
  private readonly barsSnapshot = signal<readonly PlaybackBar[]>([]);
  readonly playbackBars = this.barsSnapshot.asReadonly();
  private readonly practiceSnapshot = signal<PracticeSelection | null>(null);
  readonly practice = this.practiceSnapshot.asReadonly();
  private readonly flowSnapshot = signal<PracticeFlow>({ phase: 'idle' });
  readonly practiceFlow = this.flowSnapshot.asReadonly();
  readonly practiceSelectionError = signal(false);
  readonly countInRemaining = signal<number | null>(null);
  readonly countInFailed = signal(false);
  private readonly countIn = new CountIn();
  private countInAttempt = 0;
  private readonly guitarCapture = new GuitarCapture();
  readonly captureStatus = signal<GuitarCaptureStatus>(initialGuitarCaptureStatus());
  readonly isRecordingTake = signal(false);
  private readonly projectsSnapshot = signal<readonly StudyProjectSummary[]>([]);
  readonly projects = this.projectsSnapshot.asReadonly();
  private readonly activeProjectSnapshot = signal<StudyProject | null>(null);
  readonly activeProject = this.activeProjectSnapshot.asReadonly();
  private readonly activePhraseIdSnapshot = signal<string | null>(null);
  readonly activePhrase = computed<PracticePhrase | null>(() => {
    const project = this.activeProject();
    const id = this.activePhraseIdSnapshot();
    if (!project || !id) return null;
    return project.phrases.find((p) => p.id === id) ?? null;
  });
  private readonly variantEditorSnapshot = signal<VariantEditorState | null>(null);
  readonly activeVariant = computed<PhraseVariant | null>(() => this.variantEditorSnapshot()?.variant ?? null);
  readonly canUndoVariant = computed(() => (this.variantEditorSnapshot()?.undoStack.length ?? 0) > 0);
  readonly canRedoVariant = computed(() => (this.variantEditorSnapshot()?.redoStack.length ?? 0) > 0);
  readonly practiceRange = computed(() => {
    const selection = this.practice();
    return selection ? practiceRange(this.playbackBars(), selection) : null;
  });
  private transportController: TransportController | undefined;
  private readonly mixerSnapshot = signal<MixerState>(initialMixerState());
  readonly mixer = this.mixerSnapshot.asReadonly();
  private mixerController: MixerController | undefined;
  private adapter: AlphaTabScoreAdapter | undefined;
  private controller: ScoreController | undefined;

  private preferenceStorage(): Storage | undefined {
    try { return this.document.defaultView?.localStorage; } catch { return undefined; }
  }
  private preferences: SessionPreferences = readSessionPreferences(this.preferenceStorage());
  private savePreferences(patch: Partial<SessionPreferences>): void {
    if (Object.entries(patch).every(([key, value]) => this.preferences[key as keyof SessionPreferences] === value)) return;
    this.preferences = { ...this.preferences, ...patch };
    writeSessionPreferences(this.preferenceStorage(), this.preferences);
  }

  private store: CurrentSessionStore | undefined;
  private projectStore: IndexedDbStudyProjectStore | undefined;
  private currentFile: CurrentSessionFile | undefined;
  private activeScoreBytes: Uint8Array | undefined;
  private loadGeneration = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingTransport: SavedTransport | undefined;
  private pendingMixer: SavedMixer | undefined;
  private applyingRestore = false;

  private snapshot(): CurrentSessionState {
    const state = captureCurrentSessionState({ mode: this.mode(), scale: this.scale(), hiddenTracks: this.hidden() }, this.transport(), this.mixer());
    return { ...state, transport: this.pendingTransport ?? state.transport, mixer: this.pendingMixer ?? state.mixer };
  }
  private scheduleSave(): void {
    if (this.applyingRestore || !this.currentFile || this.state().status !== 'ready'
      || !['stopped', 'paused', 'playing'].includes(this.transport().status) || !this.mixer().available) return;
    // Solo accorpamento I/O: nessun timer fa avanzare la posizione musicale.
    this.saveTimer ??= setTimeout(() => this.flushSave(), 500);
  }
  private flushSave(): void {
    clearTimeout(this.saveTimer); this.saveTimer = undefined;
    if (this.currentFile && !this.applyingRestore) void this.store?.update(this.currentFile.id, this.snapshot());
  }

  attach(host: HTMLElement): () => void {
    let factory: IDBFactory | undefined;
    try { factory = this.document.defaultView?.indexedDB; } catch { /* Storage bloccato. */ }
    const store = new CurrentSessionStore(factory);
    this.store = store;
    const projectStore = new IndexedDbStudyProjectStore(factory);
    this.projectStore = projectStore;
    void this.refreshProjects();
    const adapter = new AlphaTabScoreAdapter(host, {
      fontDirectory: new URL('assets/alphatab/font/', this.document.baseURI).href,
      audio: {
        scriptFile: new URL('assets/alphatab/alphaTab.mjs', this.document.baseURI).href,
        soundFont: new URL('assets/alphatab/soundfont/sonivox.sf2', this.document.baseURI).href,
        scrollElement: host.closest<HTMLElement>('.score-scroll') ?? host,
      },
    });
    const controller = new ScoreController(adapter);
    const transport = new TransportController(adapter);
    this.transportController = transport;
    let restoreTransportPreferences = true;
    const unsubscribeTransport = transport.subscribe((state) => {
      this.transportSnapshot.set(state);
      if (state.status === 'idle' || state.status === 'preparing') {
        this.cancelCountIn();
        this.barsSnapshot.set([]); this.resetPractice();
      } else if (state.status === 'error') {
        this.cancelCountIn();
      } else if (state.status === 'stopped' && !this.playbackBars().length) {
        this.barsSnapshot.set(adapter.playbackBars());
      }
      if ((restoreTransportPreferences || this.pendingTransport) && state.status === 'stopped') {
        restoreTransportPreferences = false;
        const saved = this.pendingTransport;
        this.pendingTransport = undefined;
        this.applyingRestore = true;
        try {
          if (saved) restoreTransport(transport, saved);
          else transport.setSpeed(this.preferences.speed);
        } finally { this.applyingRestore = false; }
      } else if (['stopped', 'paused', 'playing'].includes(state.status)) {
        this.savePreferences({ speed: state.speed });
      }
      this.handleRecordingTransport(state);
      this.scheduleSave();
    });
    const mixer = new MixerController(adapter);
    this.mixerController = mixer;
    let restoreMixerPreferences = true;
    const unsubscribeMixer = mixer.subscribe((state) => {
      this.mixerSnapshot.set(state);
      if ((restoreMixerPreferences || this.pendingMixer) && state.available) {
        restoreMixerPreferences = false;
        const saved = this.pendingMixer;
        this.pendingMixer = undefined;
        this.applyingRestore = true;
        try {
          if (saved) restoreMixer(mixer, saved);
          else mixer.setMasterVolume(this.preferences.masterVolume);
        } finally { this.applyingRestore = false; }
      } else if (state.available) {
        this.savePreferences({ masterVolume: state.masterVolume });
      }
      this.scheduleSave();
    });
    this.adapter = adapter;
    this.controller = controller;
    const unsubscribe = controller.subscribe((state) => {
      if (state.status === 'loading') { adapter.reset(); this.hidden.set([]); this.viewError.set(null); }
      this.current.set(state);
    });
    this.available.set(true);
    const generation = this.loadGeneration;
    void store.read().then((saved) => {
      // Un'apertura esplicita o il detach prevalgono sul recupero asincrono.
      if (saved && this.controller === controller && this.loadGeneration === generation && this.state().status === 'idle') {
        void this.load({ name: saved.file.name, read: async () => saved.file.bytes }, saved.state);
      }
    });
    const flush = () => this.flushSave();
    const visibility = () => { if (this.document.visibilityState === 'hidden') flush(); };
    this.document.defaultView?.addEventListener('pagehide', flush);
    this.document.addEventListener('visibilitychange', visibility);
    return () => {
      flush(); this.loadGeneration++;
      this.currentFile = undefined; this.pendingTransport = undefined; this.pendingMixer = undefined;
      this.document.defaultView?.removeEventListener('pagehide', flush);
      this.document.removeEventListener('visibilitychange', visibility);
      this.cancelRecordingTake();
      store.close(); this.store = undefined;
      projectStore.close(); this.projectStore = undefined;
      this.activeScoreBytes = undefined;
      this.activeProjectSnapshot.set(null);
      this.available.set(false);
      this.cancelCountIn();
      this.barsSnapshot.set([]); this.resetPractice();
      unsubscribe(); controller.dispose(); adapter.destroy();
      unsubscribeTransport(); transport.dispose(); this.transportController = undefined;
      unsubscribeMixer(); mixer.dispose(); this.mixerController = undefined;
      this.adapter = undefined; this.controller = undefined;
    };
  }

  fretboardFor(trackIndex: number) {
    if (this.state().status !== 'ready') return null;
    const { tick, endTick } = this.transport();
    const frame = this.adapter?.fretboardAt(trackIndex, tick) ?? null;
    return frame && endTick > 0 && tick >= endTick ? { ...frame, positions: [] } : frame;
  }

  play(): void {
    if (this.countInRemaining() !== null) return;
    if (this.practiceFlow().phase === 'active' && this.transport().status === 'stopped') {
      this.previewPractice(); return;
    }
    if (this.practiceFlow().phase !== 'idle' && this.practiceFlow().phase !== 'active') return;
    this.transportController?.play();
  }
  beginPractice(): void {
    if (this.state().status !== 'ready' || this.viewBusy() || !this.playbackBars().length || this.practiceFlow().phase === 'active'
      || !['stopped', 'paused', 'playing'].includes(this.transport().status)) return;
    this.stop(); this.resetPractice();
    this.flowSnapshot.set({ phase: 'start' });
    this.adapter?.setPracticePicking((pick) => this.pickPractice(pick));
  }
  private pickPractice(pick: PracticeBarPick): void {
    if (this.viewBusy()) return;
    const flow = this.practiceFlow();
    const next = pickPracticeBar(flow, pick);
    this.practiceSelectionError.set(next === flow && flow.phase === 'end');
    if (next === flow) return;
    this.flowSnapshot.set(next);
    if (next.phase === 'end' || next.phase === 'configure') {
      this.adapter?.highlightPractice(next.trackIndex, next.startBar, next.phase === 'end' ? next.startBar : next.endBar);
    }
  }
  restartPracticeSelection(): void {
    if (this.practiceFlow().phase !== 'active') this.beginPractice();
  }
  async startPractice(selection: PracticeSelection): Promise<void> {
    const state = this.state();
    const flow = this.practiceFlow();
    const range = practiceRange(this.playbackBars(), selection);
    if (state.status !== 'ready' || !state.score.tracks.some(({ index }) => index === selection.trackIndex)
      || !range || flow.phase !== 'configure' || this.viewBusy() || !this.adapter
      || selection.trackIndex !== flow.trackIndex
      || this.playbackBars()[selection.from]?.barIndex !== flow.startBar
      || this.playbackBars()[selection.to]?.barIndex !== flow.endBar) return;
    const bars = this.playbackBars().slice(selection.from - range.leadInBars, selection.to + 1);
    this.viewBusy.set(true); this.viewError.set(null);
    try {
      await this.adapter.setPracticeView({ startBar: Math.min(...bars.map((bar) => bar.barIndex)),
        endBar: Math.max(...bars.map((bar) => bar.barIndex)) });
      this.practiceSnapshot.set(Object.freeze({ ...selection }));
      this.flowSnapshot.set({ ...flow, phase: 'active' });
      this.adapter.setPracticePicking(null);
      this.adapter.setPracticeTicks({ startTick: range.playbackStartTick, endTick: range.endTick });
      this.transportController?.prepareRange(range.playbackStartTick, range.endTick);
      this.adapter.highlightPractice(flow.trackIndex, flow.startBar, flow.endBar);
    } catch (error: unknown) {
      this.viewError.set(error instanceof ScoreLoadError ? error.code : 'render-failed');
    } finally { this.viewBusy.set(false); }
  }
  async finishPractice(): Promise<void> {
    if (this.viewBusy()) return;
    this.cancelCountIn(); this.transportController?.stop();
    if (this.practiceFlow().phase !== 'active') { this.resetPractice(); return; }
    if (!this.adapter) return;
    this.viewBusy.set(true); this.viewError.set(null);
    try {
      await this.adapter.setPracticeView(null);
      this.resetPractice();
    } catch (error: unknown) {
      this.viewError.set(error instanceof ScoreLoadError ? error.code : 'render-failed');
    } finally { this.viewBusy.set(false); }
  }
  private resetPractice(): void {
    this.cancelCountIn();
    this.cancelRecordingTake();
    this.activePhraseIdSnapshot.set(null);
    this.variantEditorSnapshot.set(null);
    this.practiceSnapshot.set(null);
    this.flowSnapshot.set({ phase: 'idle' }); this.practiceSelectionError.set(false);
    this.adapter?.setPracticePicking(null); this.adapter?.setPracticeTicks(null); this.adapter?.clearPracticeHighlight();
  }
  previewPractice(): void {
    const range = this.practiceRange();
    const selection = this.practice();
    if (!range || !selection || !['stopped', 'paused', 'playing'].includes(this.transport().status)) return;
    this.cancelCountIn();
    const start = () => this.transportController?.playRange(range.playbackStartTick, range.endTick);
    if (!range.countIn) { start(); return; }
    this.transportController?.pause();
    const bar = this.playbackBars()[selection.from - range.leadInBars]!;
    this.countInRemaining.set(bar.numerator);
    const attempt = this.countInAttempt;
    void this.countIn.start({ ...bar, speed: this.transport().speed },
      (remaining) => this.countInRemaining.set(remaining),
      () => { this.countInRemaining.set(null); start(); },
    ).catch(() => {
      if (attempt !== this.countInAttempt) return;
      this.countInRemaining.set(null); this.countInFailed.set(true);
    });
  }
  private cancelCountIn(): void {
    this.countInAttempt++; this.countIn.cancel(); this.countInRemaining.set(null); this.countInFailed.set(false);
  }
  pause(): void { this.cancelCountIn(); this.transportController?.pause(); }
  stop(): void {
    this.cancelCountIn(); this.transportController?.stop();
    const range = this.practiceFlow().phase === 'active' ? this.practiceRange() : null;
    if (range) this.transportController?.prepareRange(range.playbackStartTick, range.endTick);
  }
  seek(tick: number): void {
    this.cancelCountIn();
    const range = this.practiceFlow().phase === 'active' ? this.practiceRange() : null;
    if (range && !this.transport().previewRange) this.transportController?.prepareRange(range.playbackStartTick, range.endTick);
    this.transportController?.seek(range ? Math.max(range.playbackStartTick, Math.min(range.endTick - 1, tick)) : tick);
  }
  setSpeed(speed: number): void {
    this.cancelCountIn();
    this.transportController?.setSpeed(speed);
    if (this.transport().error === null) this.savePreferences({ speed: this.transport().speed });
  }
  setLoopPoint(point: 'a' | 'b'): void { if (this.practiceFlow().phase !== 'idle') return; this.cancelCountIn(); this.transportController?.setPoint(point); }
  toggleLoop(): void { if (this.practiceFlow().phase !== 'idle') return; this.cancelCountIn(); this.transportController?.toggleLoop(); }
  async toggleTrackVisibility(index: number): Promise<void> {
    const hidden = this.hidden();
    await this.showTracks(hidden.includes(index) ? hidden.filter((item) => item !== index) : [...hidden, index]);
  }

  async resetTracks(): Promise<void> {
    if (this.viewBusy() || this.state().status !== 'ready') return;
    const mixer = this.mixerController;
    for (const { index } of mixer?.state.tracks ?? []) {
      const track = mixer?.state.tracks.find((item) => item.index === index);
      if (!mixer || !track) continue;
      if (track.muted) mixer.toggleMute(index);
      if (track.solo) mixer.toggleSolo(index);
      if (track.volume !== track.defaultVolume) mixer.setVolume(index, track.defaultVolume);
    }
    if (this.hidden().length) await this.showTracks([]);
  }

  private async showTracks(hidden: readonly number[]): Promise<void> {
    const state = this.state();
    if (!this.adapter || state.status !== 'ready' || this.viewBusy()) return;
    const visible = state.score.tracks.filter(({ index }) => !hidden.includes(index)).map(({ index }) => index);
    if (!visible.length) return;
    this.viewBusy.set(true);
    this.viewError.set(null);
    try {
      await this.adapter.setVisibleTracks(visible);
      this.hidden.set(hidden);
      this.flushSave();
    } catch (error: unknown) {
      this.viewError.set(error instanceof ScoreLoadError ? error.code : 'render-failed');
    } finally { this.viewBusy.set(false); }
  }

  toggleMute(index: number): void { this.mixerController?.toggleMute(index); }
  toggleSolo(index: number): void { this.mixerController?.toggleSolo(index); }
  setTrackVolume(index: number, volume: number): void { this.mixerController?.setVolume(index, volume); }
  setMasterVolume(volume: number): void {
    this.mixerController?.setMasterVolume(volume);
    if (this.mixer().error === null) this.savePreferences({ masterVolume: this.mixer().masterVolume });
  }

  async open(file: File): Promise<void> {
    await this.load({
      name: file.name,
      read: async () => {
        try { return new Uint8Array(await file.arrayBuffer()); }
        catch { throw new ScoreLoadError('read-failed'); }
      },
    });
  }

  private async load(source: ScoreSource, saved: CurrentSessionState | null = null): Promise<void> {
    const controller = this.controller;
    if (!controller || this.viewBusy() || this.state().status === 'loading') return;
    const generation = ++this.loadGeneration;
    this.flushSave(); this.currentFile = undefined;
    this.pendingTransport = saved?.transport;
    this.pendingMixer = saved?.mixer;
    let bytes: Uint8Array | undefined;
    const loaded = await controller.load({ name: source.name, read: async () => (bytes = await source.read()) });
    if (generation !== this.loadGeneration || this.controller !== controller) return;
    if (!loaded || !bytes) { this.pendingTransport = undefined; this.pendingMixer = undefined; return; }
    const view = saved?.view ?? this.preferences;
    if (this.mode() !== view.mode || this.scale() !== view.scale) await this.setView(view.mode, view.scale);
    if (generation !== this.loadGeneration || this.controller !== controller) return;
    const savedHidden = saved?.view.hiddenTracks ?? [];
    const state = this.state();
    if (state.status === 'ready') {
      const hidden = state.score.tracks.filter(({ index }) => savedHidden.includes(index)).map(({ index }) => index);
      if (hidden.length && hidden.length < state.score.tracks.length) await this.showTracks(hidden);
    }
    if (generation !== this.loadGeneration || this.controller !== controller) return;
    // I byte originali sono distinti dalla copia consegnata dal core all'adapter.
    const file = { id: this.nextId('file'), name: source.name, bytes };
    this.currentFile = file;
    await this.store?.replace(file, this.snapshot());
    await this.syncActiveProjectOnLoad(source.name, bytes);
    if (generation === this.loadGeneration) this.scheduleSave();
  }

  async setView(mode: ScoreViewMode, scale: number): Promise<void> {
    if (!this.adapter || this.state().status !== 'ready' || this.viewBusy()) return;
    this.viewBusy.set(true); this.viewError.set(null);
    try {
      await this.adapter.setView(mode, scale);
      this.mode.set(mode); this.scale.set(scale);
      this.savePreferences({ mode, scale });
      this.scheduleSave();
    } catch (error: unknown) {
      this.viewError.set(error instanceof ScoreLoadError ? error.code : 'render-failed');
    } finally { this.viewBusy.set(false); }
  }

  private nextId(prefix: string): string {
    return this.document.defaultView?.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async refreshProjects(): Promise<void> {
    if (!this.projectStore) return;
    this.projectsSnapshot.set(await this.projectStore.listProjects());
  }

  private async syncActiveProjectOnLoad(fileName: string, bytes: Uint8Array): Promise<void> {
    const state = this.state();
    if (state.status !== 'ready') return;
    const projectId = computeScoreContentId(bytes);
    const now = new Date().toISOString();
    const existing = await this.projectStore?.loadProject(projectId);
    const project: StudyProject = existing
      ? {
          ...existing.project,
          fileName,
          title: state.score.title || fileName,
          artist: state.score.artist || '',
          trackCount: state.score.tracks.length,
          barCount: state.score.barCount,
          lastOpenedAt: now,
          phraseCount: existing.project.phrases.length,
        }
      : {
          id: projectId,
          fileName,
          title: state.score.title || fileName,
          artist: state.score.artist || '',
          trackCount: state.score.tracks.length,
          barCount: state.score.barCount,
          favorite: false,
          phraseCount: 0,
          lastOpenedAt: now,
          createdAt: now,
          phrases: [],
        };
    this.activeScoreBytes = new Uint8Array(bytes);
    this.activeProjectSnapshot.set(project);
    await this.projectStore?.saveProject(project, bytes);
    await this.refreshProjects();
  }

  private async persistActiveProject(project: StudyProject): Promise<void> {
    const normalized: StudyProject = { ...project, phraseCount: project.phrases.length };
    this.activeProjectSnapshot.set(normalized);
    await this.projectStore?.saveProject(normalized, this.activeScoreBytes);
    await this.refreshProjects();
  }

  async openSavedProject(projectId: string): Promise<void> {
    const loaded = await this.projectStore?.loadProject(projectId);
    if (!loaded) return;
    await this.load({ name: loaded.project.fileName, read: async () => loaded.scoreBytes });
  }

  async toggleProjectFavorite(projectId: string): Promise<void> {
    const updated = await this.projectStore?.toggleFavorite(projectId);
    if (!updated) return;
    if (this.activeProjectSnapshot()?.id === projectId) {
      this.activeProjectSnapshot.set(updated);
    }
    await this.refreshProjects();
  }

  async deleteSavedProject(projectId: string): Promise<void> {
    await this.projectStore?.deleteProject(projectId);
    if (this.activeProjectSnapshot()?.id === projectId) {
      this.activeProjectSnapshot.set(null);
      this.activePhraseIdSnapshot.set(null);
      this.variantEditorSnapshot.set(null);
    }
    await this.refreshProjects();
  }

  async exportActiveProject(): Promise<void> {
    const project = this.activeProjectSnapshot();
    const bytes = this.activeScoreBytes;
    if (!project || !bytes) return;
    const mediaPayloads: VariantMediaPayload[] = [];
    for (const phrase of project.phrases) {
      for (const variant of phrase.variants) {
        if (!variant.mediaId) continue;
        const item = await this.projectStore?.loadMedia(variant.mediaId);
        if (item) mediaPayloads.push(item);
      }
    }
    const bundle = exportPortableProjectBundle(project, bytes, mediaPayloads);
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `${project.fileName}.gtt.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async importProjectBundle(jsonText: string): Promise<void> {
    const parsed = JSON.parse(jsonText) as unknown;
    const { project, scoreBytes, mediaPayloads } = importPortableProjectBundle(parsed);
    await this.projectStore?.saveProject(project, scoreBytes);
    for (const payload of mediaPayloads) {
      await this.projectStore?.saveMedia(payload);
    }
    await this.refreshProjects();
    await this.load({ name: project.fileName, read: async () => scoreBytes });
  }

  async activateSavedPhrase(phraseId: string): Promise<void> {
    const project = this.activeProjectSnapshot();
    const phrase = project?.phrases.find((item) => item.id === phraseId);
    if (!phrase || this.state().status !== 'ready') return;
    const bars = this.playbackBars();
    const fromBar = bars[phrase.selection.from];
    const toBar = bars[phrase.selection.to];
    if (!fromBar || !toBar) return;
    this.stop();
    this.flowSnapshot.set({
      phase: 'configure',
      trackIndex: phrase.selection.trackIndex,
      startBar: fromBar.barIndex,
      endBar: toBar.barIndex,
    });
    await this.startPractice(phrase.selection);
    if (this.practiceFlow().phase === 'active') {
      this.activePhraseIdSnapshot.set(phrase.id);
      const variant = phrase.activeVariantId
        ? phrase.variants.find((item) => item.id === phrase.activeVariantId) ?? null
        : null;
      this.variantEditorSnapshot.set(variant ? createVariantEditor(variant) : null);
    }
  }

  async saveCurrentPhrase(customName?: string): Promise<PracticePhrase | null> {
    const project = this.activeProjectSnapshot();
    const selection = this.practice();
    const state = this.state();
    if (!project || !selection || this.practiceFlow().phase !== 'active' || state.status !== 'ready') return null;
    const now = new Date().toISOString();
    const existing = this.activePhrase();
    if (existing) {
      const updated: PracticePhrase = { ...existing, selection, updatedAt: now };
      await this.persistActiveProject({
        ...project,
        phrases: project.phrases.map((item) => (item.id === updated.id ? updated : item)),
      });
      return updated;
    }
    const trackName = state.score.tracks.find(({ index }) => index === selection.trackIndex)?.name;
    const created: PracticePhrase = {
      id: this.nextId('phrase'),
      name: customName?.trim() || formatDefaultPhraseName(this.playbackBars(), selection, trackName),
      selection,
      createdAt: now,
      updatedAt: now,
      variants: [],
      activeVariantId: null,
    };
    this.activePhraseIdSnapshot.set(created.id);
    await this.persistActiveProject({
      ...project,
      phrases: [...project.phrases, created],
    });
    return created;
  }

  async createVariantFromOriginal(): Promise<void> {
    const range = this.practiceRange();
    const selection = this.practice();
    if (!range || !selection || this.practiceFlow().phase !== 'active') return;
    const phrase = (await this.saveCurrentPhrase()) ?? this.activePhrase();
    if (!phrase) return;

    const notes = this.extractOriginalNotes(selection.trackIndex, range.startTick, range.endTick);
    const now = new Date().toISOString();
    const variant: PhraseVariant = {
      id: this.nextId('variant'),
      name: `Take ${phrase.variants.length + 1}`,
      createdAt: now,
      updatedAt: now,
      notes,
    };
    await this.appendAndActivateVariant(phrase.id, variant);
  }

  private extractOriginalNotes(trackIndex: number, startTick: number, endTick: number): VariantNote[] {
    if (!this.adapter || endTick <= startTick) return [];
    const step = 240;
    const notes: VariantNote[] = [];
    const active = new Map<string, { startOffset: number; durationTicks: number; string: number; fret: number; pitch: number }>();

    for (let tick = startTick; tick < endTick; tick += step) {
      const frame = this.adapter.fretboardAt(trackIndex, tick);
      const tuning = frame?.tuning ?? [];
      const capo = frame?.capo ?? 0;
      const seenAtTick = new Set<string>();

      for (const pos of frame?.positions ?? []) {
        const variantString = tuning.length + 1 - pos.string;
        const openPitch = tuning[variantString - 1];
        if (openPitch === undefined) continue;
        const key = `${variantString}:${pos.fret}`;
        seenAtTick.add(key);
        const existing = active.get(key);
        if (existing) {
          existing.durationTicks += step;
        } else {
          active.set(key, {
            startOffset: tick - startTick,
            durationTicks: step,
            string: variantString,
            fret: pos.fret,
            pitch: openPitch + pos.fret + capo,
          });
        }
      }

      for (const [key, item] of active.entries()) {
        if (!seenAtTick.has(key)) {
          notes.push({
            id: `orig-${item.startOffset}-${item.string}-${item.fret}`,
            tickOffset: item.startOffset,
            durationTicks: item.durationTicks,
            string: item.string,
            fret: item.fret,
            pitch: item.pitch,
            velocity: 100,
            edited: false,
          });
          active.delete(key);
        }
      }
    }

    for (const item of active.values()) {
      notes.push({
        id: `orig-${item.startOffset}-${item.string}-${item.fret}`,
        tickOffset: item.startOffset,
        durationTicks: item.durationTicks,
        string: item.string,
        fret: item.fret,
        pitch: item.pitch,
        velocity: 100,
        edited: false,
      });
    }

    return notes.sort((a, b) => a.tickOffset - b.tickOffset || a.string - b.string);
  }

  private async appendAndActivateVariant(phraseId: string, variant: PhraseVariant): Promise<void> {
    const project = this.activeProjectSnapshot();
    if (!project) return;
    const updatedPhrases = project.phrases.map((phrase) =>
      phrase.id === phraseId
        ? {
            ...phrase,
            updatedAt: variant.updatedAt,
            variants: [...phrase.variants, variant],
            activeVariantId: variant.id,
          }
        : phrase,
    );
    this.variantEditorSnapshot.set(createVariantEditor(variant));
    await this.persistActiveProject({ ...project, phrases: updatedPhrases });
  }

  async selectVariant(variantId: string | null): Promise<void> {
    const project = this.activeProjectSnapshot();
    const phrase = this.activePhrase();
    if (!project || !phrase) return;
    const variant = variantId ? phrase.variants.find((item) => item.id === variantId) ?? null : null;
    this.variantEditorSnapshot.set(variant ? createVariantEditor(variant) : null);
    const updatedPhrases = project.phrases.map((item) =>
      item.id === phrase.id ? { ...item, activeVariantId: variant?.id ?? null } : item,
    );
    await this.persistActiveProject({ ...project, phrases: updatedPhrases });
  }

  toggleMonitorInput(): void {
    this.guitarCapture.setMonitor(!this.captureStatus().monitor);
  }

  async startRecordTake(): Promise<void> {
    const range = this.practiceRange();
    if (!range || this.practiceFlow().phase !== 'active' || this.isRecordingTake()) return;
    const phrase = (await this.saveCurrentPhrase()) ?? this.activePhrase();
    if (!phrase) return;

    try {
      await this.guitarCapture.start((status) => this.captureStatus.set(status));
    } catch {
      return;
    }

    this.isRecordingTake.set(true);
    this.previewPractice();
  }

  stopRecordTake(): void {
    if (!this.isRecordingTake()) return;
    if (this.guitarCapture.isRecordingWindow()) {
      void this.finalizeRecordedTake();
    } else {
      this.cancelRecordingTake();
    }
    this.stop();
  }

  private cancelRecordingTake(): void {
    this.isRecordingTake.set(false);
    this.guitarCapture.stop();
  }

  private handleRecordingTransport(state: TransportState): void {
    if (!this.isRecordingTake()) return;
    const range = this.practiceRange();
    if (!range) {
      this.cancelRecordingTake();
      return;
    }
    if (state.status === 'playing') {
      if (state.tick >= range.startTick && state.tick < range.endTick && !this.guitarCapture.isRecordingWindow()) {
        this.guitarCapture.beginWindow();
      } else if (state.tick >= range.endTick && this.guitarCapture.isRecordingWindow()) {
        void this.finalizeRecordedTake();
      }
    } else if (state.status === 'stopped') {
      if (this.guitarCapture.isRecordingWindow()) {
        void this.finalizeRecordedTake();
      }
    } else if (state.status === 'idle' || state.status === 'error') {
      this.cancelRecordingTake();
    }
  }

  private async finalizeRecordedTake(): Promise<void> {
    this.isRecordingTake.set(false);
    const range = this.practiceRange();
    const selection = this.practice();
    const phrase = this.activePhrase();
    const project = this.activeProjectSnapshot();
    if (!range || !selection || !phrase || !project) {
      this.guitarCapture.stop();
      return;
    }
    const frame = this.adapter?.fretboardAt(selection.trackIndex, range.startTick);
    const result = this.guitarCapture.endWindow({
      totalPhraseTicks: Math.max(1, range.endTick - range.startTick),
      openTuningMidi: frame?.tuning,
    });
    this.guitarCapture.stop();

    const now = new Date().toISOString();
    const variantId = this.nextId('variant');
    let mediaId: string | undefined;
    if (result.smfBytes.byteLength > 0) {
      mediaId = this.nextId('media');
      await this.projectStore?.saveMedia({
        id: mediaId,
        projectId: project.id,
        phraseId: phrase.id,
        variantId,
        mimeType: 'audio/midi',
        bytes: result.smfBytes,
      });
    }

    const variant: PhraseVariant = {
      id: variantId,
      name: `Take ${phrase.variants.length + 1}`,
      createdAt: now,
      updatedAt: now,
      notes: result.notes,
      ...(mediaId ? { mediaId } : {}),
    };
    await this.appendAndActivateVariant(phrase.id, variant);
  }

  variantNotesAtCurrentTick(trackIndex: number): readonly VariantNote[] {
    const variant = this.activeVariant();
    const range = this.practiceRange();
    const selection = this.practice();
    if (!variant || !range || !selection || selection.trackIndex !== trackIndex) return [];
    const { tick, status } = this.transport();
    if (tick >= range.endTick) return [];
    if (tick < range.startTick && status === 'playing') return [];
    const relTick = Math.max(0, tick - range.startTick);
    return variant.notes.filter(
      (note) => note.tickOffset <= relTick && relTick < note.tickOffset + note.durationTicks,
    );
  }

  canEditFretboardVariant(trackIndex: number): boolean {
    const selection = this.practice();
    const status = this.transport().status;
    return (
      this.activeVariant() !== null &&
      selection !== null &&
      selection.trackIndex === trackIndex &&
      (status === 'stopped' || status === 'paused')
    );
  }

  async editVariantNoteOnFretboard(variantString: number, fret: number, openTuningMidi?: readonly number[]): Promise<void> {
    const editor = this.variantEditorSnapshot();
    const range = this.practiceRange();
    const selection = this.practice();
    if (!editor || !range || !selection || !this.canEditFretboardVariant(selection.trackIndex)) return;

    const relTick = Math.max(0, Math.min(range.endTick - range.startTick - 1, this.transport().tick - range.startTick));
    const toleranceTicks = 60;
    const existing = editor.variant.notes.find(
      (note) => note.string === variantString && Math.abs(note.tickOffset - relTick) <= toleranceTicks,
    );

    const nextEditor = existing && existing.fret === fret
      ? removeVariantNote(editor, { id: existing.id })
      : upsertVariantNoteOnFretboard(editor, {
          tickOffset: existing ? existing.tickOffset : relTick,
          durationTicks: existing ? existing.durationTicks : 480,
          string: variantString,
          fret,
          openTuningMidi,
          toleranceTicks,
        });

    if (nextEditor === editor) return;
    await this.commitVariantEditor(nextEditor);
  }

  async undoVariantEdit(): Promise<void> {
    const editor = this.variantEditorSnapshot();
    if (!editor) return;
    const next = applyUndoVariantEdit(editor);
    if (next === editor) return;
    await this.commitVariantEditor(next);
  }

  async redoVariantEdit(): Promise<void> {
    const editor = this.variantEditorSnapshot();
    if (!editor) return;
    const next = applyRedoVariantEdit(editor);
    if (next === editor) return;
    await this.commitVariantEditor(next);
  }

  private async commitVariantEditor(nextEditor: VariantEditorState): Promise<void> {
    this.variantEditorSnapshot.set(nextEditor);
    const project = this.activeProjectSnapshot();
    const phrase = this.activePhrase();
    if (!project || !phrase) return;
    const updatedPhrases = project.phrases.map((item) =>
      item.id === phrase.id
        ? {
            ...item,
            updatedAt: nextEditor.variant.updatedAt,
            variants: item.variants.map((v) => (v.id === nextEditor.variant.id ? nextEditor.variant : v)),
          }
        : item,
    );
    await this.persistActiveProject({ ...project, phrases: updatedPhrases });
  }
}

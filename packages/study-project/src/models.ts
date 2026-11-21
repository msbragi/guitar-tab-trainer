import type { PracticeSelection } from '@guitar-practice/core';

/**
 * Single musical note within a phrase variant (either transcribed from guitar audio
 * or corrected/inserted on the fretboard).
 * Coordinates remain independent of alphaTab's internal model.
 */
export interface VariantNote {
  readonly id: string;
  /** Offset in musical ticks relative to the phrase punch-in startTick (0 = startTick). */
  readonly tickOffset: number;
  /** Duration in musical ticks. */
  readonly durationTicks: number;
  /** 1-based guitar string number (1 = highest string, e.g. high E). */
  readonly string: number;
  /** Fret number (0 = open string). */
  readonly fret: number;
  /** MIDI pitch number (0..127). */
  readonly pitch: number;
  /** MIDI velocity (1..127). */
  readonly velocity: number;
  /** True if the user manually corrected or inserted this note on the fretboard. */
  readonly edited?: boolean;
}

/**
 * A recorded or simulated take / variant belonging to a PracticePhrase.
 * The original Guitar Pro phrase is never mutated; variants store their own notes
 * and an optional reference to recorded media (SMF MIDI or audio blob).
 */
export interface PhraseVariant {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly notes: readonly VariantNote[];
  /** Optional ID referencing a stored media payload (e.g. SMF MIDI or PCM/audio) in the media store. */
  readonly mediaId?: string;
}

/**
 * A saved practice phrase (bar range + preparation settings + user variants) within a StudyProject.
 */
export interface PracticePhrase {
  readonly id: string;
  readonly name: string;
  readonly selection: PracticeSelection;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly variants: readonly PhraseVariant[];
  /** Currently selected variant ID, or null when viewing the immutable original GP phrase. */
  readonly activeVariantId: string | null;
}

/**
 * Lightweight mixer and playback preference snapshot saved per StudyProject.
 */
export interface ProjectPracticeSettings {
  readonly speed: number;
  readonly masterVolume: number;
  readonly mutedTracks: readonly number[];
  readonly soloTracks: readonly number[];
  readonly hiddenTracks: readonly number[];
  readonly trackVolumes: Readonly<Record<number, number>>;
}

/**
 * Summary entry displayed in the Left Sidebar Library (Recent Files & Favorites).
 */
export interface StudyProjectSummary {
  /** Deterministic content hash (e.g. SHA-256 hex) of the immutable Guitar Pro file bytes. */
  readonly id: string;
  readonly fileName: string;
  readonly title: string;
  readonly artist: string;
  readonly trackCount: number;
  readonly barCount: number;
  readonly favorite: boolean;
  readonly phraseCount: number;
  readonly lastOpenedAt: string;
  readonly createdAt: string;
}

/**
 * Full persistent StudyProject metadata (stored alongside immutable GP bytes in StudyProjectStoragePort).
 */
export interface StudyProject extends StudyProjectSummary {
  readonly phrases: readonly PracticePhrase[];
  readonly settings?: ProjectPracticeSettings;
}

/**
 * Optional media attachment for a PhraseVariant (e.g. Standard MIDI File or recorded guitar audio).
 */
export interface VariantMediaPayload {
  readonly id: string;
  readonly projectId: string;
  readonly phraseId: string;
  readonly variantId: string;
  readonly mimeType: 'audio/midi' | 'audio/wav' | 'audio/webm';
  readonly bytes: Uint8Array;
}

/**
 * Portable JSON bundle for exporting and importing a StudyProject across devices.
 */
export interface PortableProjectBundle {
  readonly format: 'gtt-project-v1';
  readonly exportedAt: string;
  readonly project: StudyProject;
  /** Base64-encoded immutable original Guitar Pro file bytes. */
  readonly scoreBase64: string;
  /** Optional Base64-encoded media payloads keyed by mediaId. */
  readonly mediaBase64?: Readonly<Record<string, { readonly mimeType: VariantMediaPayload['mimeType']; readonly data: string }>>;
}

/**
 * Storage-technology-agnostic contract for M6 Study Projects.
 * Can be backed by IndexedDB in the browser, filesystem on desktop, or an in-memory store in tests.
 */
export interface StudyProjectStoragePort {
  listProjects(): Promise<readonly StudyProjectSummary[]>;
  loadProject(projectId: string): Promise<{ readonly project: StudyProject; readonly scoreBytes: Uint8Array } | null>;
  saveProject(project: StudyProject, scoreBytes?: Uint8Array): Promise<void>;
  toggleFavorite(projectId: string, favorite?: boolean): Promise<StudyProject | null>;
  deleteProject(projectId: string): Promise<void>;
  loadMedia(mediaId: string): Promise<VariantMediaPayload | null>;
  saveMedia(payload: VariantMediaPayload): Promise<void>;
  deleteMedia(mediaId: string): Promise<void>;
}

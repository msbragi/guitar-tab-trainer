import { describe, expect, it } from 'vitest';
import {
  InMemoryStudyProjectStore,
  type PhraseVariant,
  type StudyProject,
  computeScoreContentId,
  createVariantEditor,
  exportPortableProjectBundle,
  formatDefaultPhraseName,
  importPortableProjectBundle,
  mapTranscribedNotesToVariantNotes,
  redoVariantEdit,
  removeVariantNote,
  undoVariantEdit,
  upsertVariantNoteOnFretboard,
} from '../src/index.js';

describe('Variant Editor & Fretboard Note Correction (M5)', () => {
  const initialVariant: PhraseVariant = {
    id: 'var-1',
    name: 'Take 1',
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    notes: [
      {
        id: 'n-1',
        tickOffset: 0,
        durationTicks: 480,
        string: 2,
        fret: 5,
        pitch: 64,
        velocity: 95,
      },
    ],
  };

  it('inserts, updates, removes, and supports full undo/redo on the fretboard', () => {
    let editor = createVariantEditor(initialVariant);

    // Correct existing note at tick 0 on string 2 from fret 5 (E4=64) to fret 7 (F#4=66)
    editor = upsertVariantNoteOnFretboard(editor, {
      tickOffset: 10,
      durationTicks: 480,
      string: 2,
      fret: 7,
      toleranceTicks: 60,
    });
    expect(editor.variant.notes.length).toBe(1);
    expect(editor.variant.notes[0]!.fret).toBe(7);
    expect(editor.variant.notes[0]!.pitch).toBe(66);
    expect(editor.variant.notes[0]!.edited).toBe(true);

    // Insert a second note at tick 480 on string 1 fret 5 (A4=69)
    editor = upsertVariantNoteOnFretboard(editor, {
      tickOffset: 480,
      durationTicks: 480,
      string: 1,
      fret: 5,
    });
    expect(editor.variant.notes.length).toBe(2);

    // Remove the first note
    editor = removeVariantNote(editor, { id: 'n-1' });
    expect(editor.variant.notes.length).toBe(1);
    expect(editor.variant.notes[0]!.tickOffset).toBe(480);

    // Undo removal -> 2 notes again
    editor = undoVariantEdit(editor);
    expect(editor.variant.notes.length).toBe(2);

    // Undo insertion -> 1 note at fret 7
    editor = undoVariantEdit(editor);
    expect(editor.variant.notes.length).toBe(1);
    expect(editor.variant.notes[0]!.fret).toBe(7);

    // Undo fret edit -> back to original fret 5
    editor = undoVariantEdit(editor);
    expect(editor.variant.notes[0]!.fret).toBe(5);

    // Redo fret edit -> fret 7
    editor = redoVariantEdit(editor);
    expect(editor.variant.notes[0]!.fret).toBe(7);
  });

  it('maps transcribed audio notes onto phrase ticks and context-aware fretboard positions', () => {
    const mapped = mapTranscribedNotesToVariantNotes({
      transcribed: [
        {
          channel: 0,
          pitch: 64,
          velocity: 100,
          startSample: 0,
          endSample: 24000,
        },
        {
          channel: 0,
          pitch: 67,
          velocity: 110,
          startSample: 24000,
          endSample: 48000,
        },
      ],
      sampleRate: 48000,
      totalPhraseSamples: 48000,
      totalPhraseTicks: 1920,
      preferredFretByTick: () => 5,
    });

    expect(mapped.length).toBe(2);
    expect(mapped[0]).toMatchObject({
      tickOffset: 0,
      durationTicks: 960,
      string: 2,
      fret: 5,
      pitch: 64,
    });
    expect(mapped[1]).toMatchObject({
      tickOffset: 960,
      durationTicks: 960,
      string: 1,
      fret: 3,
      pitch: 67,
    });
  });
});

describe('StudyProjectStoragePort & Portable Bundle Export/Import (M6)', () => {
  it('stores projects, toggles favorites, and roundtrips portable bundles with GP bytes and media', async () => {
    const store = new InMemoryStudyProjectStore();
    const gpBytes = new Uint8Array([0x47, 0x50, 0x35, 1, 2, 3, 4, 5]);
    const id = computeScoreContentId(gpBytes);

    const project: StudyProject = {
      id,
      fileName: 'comfortably-numb.gp5',
      title: 'Comfortably Numb',
      artist: 'Pink Floyd',
      trackCount: 7,
      barCount: 93,
      favorite: false,
      phraseCount: 1,
      createdAt: '2026-11-21T10:00:00.000Z',
      lastOpenedAt: '2026-11-21T12:00:00.000Z',
      phrases: [
        {
          id: 'phrase-1',
          name: formatDefaultPhraseName(
            [],
            {
              trackIndex: 2,
              from: 74,
              to: 75,
              leadInBars: 1,
              preparation: 'context',
            },
            'Solo/Fills',
          ),
          selection: {
            trackIndex: 2,
            from: 74,
            to: 75,
            leadInBars: 1,
            preparation: 'context',
          },
          createdAt: '2026-11-21T11:00:00.000Z',
          updatedAt: '2026-11-21T11:00:00.000Z',
          activeVariantId: 'var-1',
          variants: [
            {
              id: 'var-1',
              name: 'Take 1',
              createdAt: '2026-11-21T11:00:00.000Z',
              updatedAt: '2026-11-21T11:00:00.000Z',
              mediaId: 'media-1',
              notes: [],
            },
          ],
        },
      ],
    };

    await store.saveProject(project, gpBytes);
    await store.saveMedia({
      id: 'media-1',
      projectId: id,
      phraseId: 'phrase-1',
      variantId: 'var-1',
      mimeType: 'audio/midi',
      bytes: new Uint8Array([0x4d, 0x54, 0x68, 0x64]),
    });

    const summaries = await store.listProjects();
    expect(summaries.length).toBe(1);
    expect(summaries[0]!.favorite).toBe(false);

    const toggled = await store.toggleFavorite(id);
    expect(toggled?.favorite).toBe(true);

    const loaded = await store.loadProject(id);
    const media = await store.loadMedia('media-1');
    expect(loaded).not.toBeNull();
    expect(media).not.toBeNull();

    const bundle = exportPortableProjectBundle(
      loaded!.project,
      loaded!.scoreBytes,
      [media!],
    );
    const unpacked = importPortableProjectBundle(bundle);
    expect(unpacked.project.id).toBe(id);
    expect(unpacked.project.favorite).toBe(true);
    expect(unpacked.scoreBytes).toEqual(gpBytes);
    expect(unpacked.mediaPayloads.length).toBe(1);
    expect(unpacked.mediaPayloads[0]!.bytes).toEqual(
      new Uint8Array([0x4d, 0x54, 0x68, 0x64]),
    );
  });
});

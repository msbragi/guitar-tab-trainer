export type {
  PortableProjectBundle,
  PhraseVariant,
  PracticePhrase,
  ProjectPracticeSettings,
  StudyProject,
  StudyProjectStoragePort,
  StudyProjectSummary,
  VariantMediaPayload,
  VariantNote,
} from './models.js';
export {
  computeScoreContentId,
  createVariantEditor,
  formatDefaultPhraseName,
  mapTranscribedNotesToVariantNotes,
  redoVariantEdit,
  removeVariantNote,
  undoVariantEdit,
  upsertVariantNoteOnFretboard,
} from './variant-editor.js';
export type { VariantEditorState } from './variant-editor.js';
export {
  InMemoryStudyProjectStore,
  exportPortableProjectBundle,
  importPortableProjectBundle,
} from './storage.js';

# Piano Esecutivo M5 & M6 — Progetti di Studio, Varianti, Fretboard Editing e Razionalizzazione UI

Stato baseline del 21 novembre 2026.
I pacchetti di dominio e DSP sono già implementati, compilati e verificati da test unitari:
- `@guitar-practice/core` ([audio-conversion.ts](../packages/core/src/audio-conversion.ts)): contratto agnostico `AudioToMidiPort`, `AudioToMidiConfig`, `TranscribedNote`, `TunerReading`, `suggestGuitarPosition`.
- `@guitar-practice/audio-engine` ([index.ts](../packages/audio-engine/src/index.ts)): motore Audio → MIDI in TypeScript puro (porting MIT di Hendrix DSP + Mobile Bonus: `HendrixAudioToMidiEngine`, `HendrixProcessor`, `HendrixMidiReader`, `MidiRecording.toSmf`, `extractNotes`, `tuner`).
- `@guitar-practice/study-project` ([index.ts](../packages/study-project/src/index.ts)): modelli e logica pura per M5/M6 (`StudyProject`, `PracticePhrase`, `PhraseVariant`, `VariantNote`, `StudyProjectStoragePort`, `InMemoryStudyProjectStore`, editor immutabile con Undo/Redo `createVariantEditor`, `upsertVariantNoteOnFretboard`, `removeVariantNote`, `undoVariantEdit`, `redoVariantEdit`, `mapTranscribedNotesToVariantNotes`, `computeScoreContentId`, export/import `exportPortableProjectBundle` / `importPortableProjectBundle`).

---

## Obiettivo dell'implementazione

Completare l'integrazione applicativa in `apps/web` per:
1. **Razionalizzare la UI**: rimuovere i tab placeholder morti dalla topbar (`Library`, `Projects`, `Virtual Rig`), mantenendo solo `Practice` e `Settings`.
2. **Attivare M6 Storage & Projects nella Sidebar Sinistra (`LIBRARY`)**:
   - Implementare l'adapter browser IndexedDB (`IndexedDbStudyProjectStore`) conforme a `StudyProjectStoragePort`.
   - Popolare dinamicamente **Recent Files**, **Favorites** (con toggle stellina) e **Saved Phrases** del brano attivo, più **Export / Import Project** (`.gtt.json`).
3. **Completare il flusso M5 (Varianti, Cattura Audio e Correzione Note sulla Fretboard)**:
   - Nella barra `Practice a phrase` (quando `stage === 'active'`), permettere di:
     - Salvare la frase corrente nel progetto attivo (`Save Phrase`).
     - Creare una variante tramite **registrazione chitarra reale** (`getUserMedia` → `HendrixAudioToMidiEngine` tra Punch-In e Punch-Out, con toggle Monitor opzionale e indicatore Tuner/livello) oppure tramite **Take simulato / da originale** per l'editing immediato.
     - Selezionare la vista attiva: **`Original GP`** (immutabile) oppure una delle **`PhraseVariant`** (`Take 1`, `Take 2`, ...).
   - Nella **Fretboard** (`apps/web/src/app/viewer/fretboard/`):
     - Quando è attiva una `PhraseVariant`, mostrare le note della variante al tick corrente (evidenziando eventuali differenze rispetto alle note originali del GP).
     - Da fermo/pausa, consentire il **click su corda/tasto della Fretboard** per aggiungere, spostare di tasto o rimuovere una nota della variante tramite `upsertVariantNoteOnFretboard` / `removeVariantNote`, con pulsanti **Undo / Redo**.

---

## Step 1 — Razionalizzazione della Top Navigation Bar

### File coinvolti
- [apps/web/src/app/layout/navigation.ts](../apps/web/src/app/layout/navigation.ts)
- [apps/web/src/app/app/app.html](../apps/web/src/app/app/app.html)
- [apps/web/src/app/app/app.ts](../apps/web/src/app/app/app.ts)
- [apps/web/public/i18n/en.json](../apps/web/public/i18n/en.json) e [it.json](../apps/web/public/i18n/it.json)

### Modifiche richieste
1. In `navigation.ts`, ridurre `Section` a `'practice' | 'settings'`:
   ```ts
   export type Section = 'practice' | 'settings';
   export const sections: readonly { id: Section; icon: IconName }[] = [
     { id: 'practice', icon: 'play' },
     { id: 'settings', icon: 'settings' },
   ];
   ```
2. In `app.html`, rimuovere il blocco `@else if (section() !== 'practice')` che mostrava la pagina placeholder *"Coming in a future update"*.
3. Aggiornare o rimuovere eventuali test che cliccavano sui vecchi tab placeholder (`library`, `projects`, `rig`).

---

## Step 2 — Adapter IndexedDB per M6 (`IndexedDbStudyProjectStore`)

### File da creare
- `apps/web/src/app/projects/indexeddb-project-store.ts`
- `apps/web/test/indexeddb-project-store.test.ts`

### Specifiche tecniche
1. Implementare `StudyProjectStoragePort` (da `@guitar-practice/study-project`) usando IndexedDB nativo (database `guitar-practice-projects-v1`, distinto da `guitar-practice-current-session` di M4 che rimane invariato per il recupero rapido al refresh).
2. Creare 3 object store:
   - `projects` (keyPath: `id` → oggetto `StudyProject`)
   - `scores` (keyPath: `id` → `Uint8Array` dei byte originali `.gp`)
   - `media` (keyPath: `id` → `VariantMediaPayload` con indice `byProjectId` su `projectId`)
3. Prevedere un fallback automatico e trasparente a `InMemoryStudyProjectStore` se `indexedDB` non è disponibile o bloccato nel browser, così l'app continua a funzionare per tutta la sessione senza crash.
4. Scrivere test unitari in `apps/web/test/indexeddb-project-store.test.ts`.

---

## Step 3 — Integrazione Progetti in `ScoreSession` e Sidebar `LibraryPanel`

### File coinvolti
- [apps/web/src/app/score-session.ts](../apps/web/src/app/score-session.ts)
- [apps/web/src/app/layout/library-panel/library-panel.ts](../apps/web/src/app/layout/library-panel/library-panel.ts)
- [apps/web/src/app/layout/library-panel/library-panel.html](../apps/web/src/app/layout/library-panel/library-panel.html)
- [apps/web/src/app/layout/library-panel/library-panel.css](../apps/web/src/app/layout/library-panel/library-panel.css)

### Modifiche richieste
1. **In `ScoreSession`**:
   - Esporre i signal reattivi:
     - `projects = signal<readonly StudyProjectSummary[]>([])`
     - `activeProject = signal<StudyProject | null>(null)`
   - Quando un file Guitar Pro viene caricato con successo (`loadScore`):
     - Calcolare l'ID deterministico con `computeScoreContentId(bytes)`.
     - Cercare se il progetto esiste già nello store:
       - Se esiste: aggiornarne `lastOpenedAt`, ripristinare `phrases` (e impostazioni opzionali) e salvarlo.
       - Se non esiste: creare un nuovo `StudyProject` con `title`, `artist`, `fileName`, `trackCount`, `barCount`, `favorite: false`, `phrases: []` e salvarlo nello store insieme a `scoreBytes`.
     - Aggiornare la lista `projects()`.
   - Aggiungere i metodi pubblici:
     - `openSavedProject(projectId: string)`: carica `{ project, scoreBytes }` dallo store e apre la partitura senza chiedere il file dal disco.
     - `toggleProjectFavorite(projectId: string)`: inverte il flag `favorite` nello store e aggiorna `projects()` e `activeProject()`.
     - `deleteSavedProject(projectId: string)`: elimina il progetto dallo store e aggiorna `projects()`.
     - `exportActiveProject()`: usa `exportPortableProjectBundle` per generare e scaricare `<fileName>.gtt.json`.
     - `importProjectBundle(jsonText: string)`: usa `importPortableProjectBundle`, salva progetto/byte/media nello store e lo apre.
2. **In `LibraryPanel`**:
   - Sostituire i messaggi placeholder *"Recent files will be available in a future update"* e *"Favorites will be available in a future update"* con le liste reali derivate da `session.projects()`:
     - **Recent Files**: elenco dei progetti ordinati per `lastOpenedAt` decrescente. Click sul nome apre il progetto; pulsante stellina (`star`) attiva/disattiva `favorite`; pulsante elimina rimuove il progetto. Evidenziare il progetto attualmente aperto (`session.activeProject()?.id`).
     - **Favorites**: elenco filtrato (`p.favorite === true`).
     - **Saved Phrases** (visibile quando `session.activeProject()?.phrases.length > 0`): elenco delle frasi salvate del brano attivo; cliccandone una, avvia automaticamente la pratica su quella frase (`session.activateSavedPhrase(phraseId)`).
     - Pulsanti compatti in fondo al pannello Library: **Export Project** (se c'è un progetto attivo) e **Import Project** (file `.gtt.json`).

---

## Step 4 — Gestione Frasi, Cattura Chitarra (`AudioToMidiPort`) e Varianti in `PracticePanel`

### File coinvolti
- `apps/web/src/app/practice/guitar-capture.ts` (nuovo modulo browser indipendente da Angular, come `count-in.ts`)
- [apps/web/src/app/score-session.ts](../apps/web/src/app/score-session.ts)
- [apps/web/src/app/practice/practice-panel/practice-panel.ts](../apps/web/src/app/practice/practice-panel/practice-panel.ts)
- [apps/web/src/app/practice/practice-panel/practice-panel.html](../apps/web/src/app/practice/practice-panel/practice-panel.html)
- [apps/web/src/app/practice/practice-panel/practice-panel.css](../apps/web/src/app/practice/practice-panel/practice-panel.css)

### Specifiche tecniche
1. **Modulo `guitar-capture.ts` (indipendente da Angular)**:
   - Gestisce l'acquisizione Web Audio (`navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`).
   - Alimenta un'istanza di `AudioToMidiPort` (di default `new HendrixAudioToMidiEngine(audioContext.sampleRate)` da `@guitar-practice/audio-engine`).
   - Supporta il toggle **Monitor Input ON/OFF** (collegando o scollegando la sorgente a `audioContext.destination`, di default `OFF` per evitare eco con direct monitor hardware).
   - Raccoglie gli eventi `SampledMidiEvent` solo nella finestra tra **Punch-In (`startTick`)** e **Punch-Out (`endTick`)**, mentre fuori dalla finestra aggiorna comunque `tuner()` e `telemetry().levelDb`.
   - Al Punch-Out (o stop), invoca `extractNotes(events, totalSamples)` e `mapTranscribedNotesToVariantNotes(...)` per restituire la lista di `VariantNote[]` e il buffer SMF (`MidiRecording.toSmf`).
2. **In `ScoreSession` e `PracticePanel` (quando `flow().phase === 'active'`)**:
   - **Salvataggio Frase**: pulsante `Save Phrase` che crea o aggiorna una `PracticePhrase` dentro `activeProject`.
   - **Creazione Variante / Take**:
     - Pulsante **`● Record Take`**: avvia la passata (con eventuale count-in e contesto) attivando la cattura tra `startTick` e `endTick`; a fine passata crea una nuova `PhraseVariant` (`Take N`) con le note trascritte.
     - Pulsante **`+ New Variant`** (anche senza microfono): clona le note originali del frammento GP in una nuova `PhraseVariant` modificabile, permettendo all'utente di creare o correggere una variante sulla Fretboard anche offline/senza chitarra collegata.
   - **Selettore Vista Variante**:
     - Menu o pill selector nella barra `Practice a phrase`: **`Original GP`** vs **`Take 1`**, **`Take 2`**, ecc.
     - Quando una variante è selezionata, `ScoreSession` mantiene un `VariantEditorState` (`createVariantEditor(variant)`) e salva automaticamente le modifiche nel progetto attivo.

---

## Step 5 — Visualizzazione e Correzione Note sulla Fretboard (con Undo/Redo)

### File coinvolti
- [apps/web/src/app/viewer/fretboard/fretboard.ts](../apps/web/src/app/viewer/fretboard/fretboard.ts)
- [apps/web/src/app/viewer/fretboard/fretboard.html](../apps/web/src/app/viewer/fretboard/fretboard.html)
- [apps/web/src/app/viewer/fretboard/fretboard.css](../apps/web/src/app/viewer/fretboard/fretboard.css)

### Specifiche tecniche
1. **Confronto Originale vs Variante**:
   - Quando `session.activeVariant()` è presente, la Fretboard riceve le `VariantNote[]` attive al tick corrente (`tick - practiceRange.startTick`).
   - I marker della variante sono chiaramente distinguibili (es. bordo evidenziato / badge `Edited` se `note.edited === true`), mantenendo un riferimento visivo leggero (marker tratteggiato) se la nota originale del GP su quella corda era su un tasto diverso.
2. **Editing interattivo al click su Corda/Tasto**:
   - Quando una `PhraseVariant` è selezionata e il trasporto è in pausa/stop dentro il range della frase:
     - Cliccare su un'intersezione `(string, fret)` della Fretboard chiama `session.editVariantNoteOnFretboard(string, fret)`:
       - Se su quella corda e a quel tick c'è già una nota sullo **stesso tasto**, la rimuove (`removeVariantNote`).
       - Altrimenti la inserisce o la sposta sul nuovo tasto (`upsertVariantNoteOnFretboard`), aggiornando il pitch con l'accordatura della traccia.
3. **Controlli Undo / Redo**:
   - Nella barra superiore della Fretboard (accanto al selettore traccia), quando una variante è attiva, mostrare i pulsanti compatti **Undo** (`[disabled]="!session.canUndoVariant()"`) e **Redo** (`[disabled]="!session.canRedoVariant()"`).

---

## Step 6 — Localizzazione EN/IT, Test e Verifica Confini

1. Aggiungere tutte le nuove chiavi di traduzione sia in `apps/web/public/i18n/en.json` sia in `apps/web/public/i18n/it.json` (mantenendo la parità verificata da `apps/web/test/catalogues.test.ts`).
2. Eseguire e far passare:
   - `pnpm check:boundaries`
   - `pnpm build`
   - `pnpm typecheck`
   - `pnpm test` (tutti i test Node di `core`, `audio-engine`, `study-project`, `alphatab-adapter` e `web`).
3. Non arrestare il server di sviluppo sulla porta 4200 e non eseguire commit/push.

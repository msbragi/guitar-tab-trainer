# Guitar Tab Trainer

Guitar Tab Trainer is a modular guitar practice application built around [alphaTab](https://github.com/CoderLine/alphaTab).

The project uses a pnpm monorepo with an Angular UI, a UI-independent TypeScript orchestrator, and alphaTab integrated as an external dependency through a dedicated adapter.

The goal is to provide an environment for learning guitar parts through interactive tablatures, synchronized backing tracks, and eventually live guitar audio.

The project is also an experiment in AI-assisted software development, with human supervision of architectural decisions and validation.

**Current status:** M0–M3 are complete. **M4 — Playback & Fretboard**, **M5 — Guitar Capture & Play Session**, and **M6 — Storage & Projects** are functionally implemented, with manual browser verification, real-guitar device calibration, and historical Playwright test debt still open. See [TODO.md](TODO.md) and [docs/M5_M6_PLAN.md](docs/M5_M6_PLAN.md).

## Development Environment

- Node.js 22.22.0 (`.nvmrc`).
- pnpm 10.34.9, pinned through `packageManager`.
- Angular 21.2.26, CLI/build 21.2.30.
- TypeScript 5.9.3.
- alphaTab 1.9.0 (stable).
- Transloco 8.4.0 for UI internationalization.

The alphaTab 1.10.0 source checkout referenced in the technical analysis is not the installed dependency version.

Transloco 8.4.0 declares Angular >=16 and RxJS >=6 peer dependencies, compatible with the installed Angular 21.2.26 and RxJS 7.8.2. See the [published package manifest](https://registry.npmjs.org/@jsverse/transloco/8.4.0).

With Corepack available:

```sh
corepack enable
corepack pnpm --version
```

## Getting Started

Run the following commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm dev
```

The development application is available at:

http://127.0.0.1:4200

The `dev` command builds the shared packages before starting the TypeScript and Angular watchers.

Development-server dependency prebundling is disabled. Dependencies remain explicitly declared in their respective pnpm packages and are included in the application build.

The production client build is generated in:

`apps/web/dist/web/browser`

## Features

### UI Shell — Implemented

The layout follows [the design reference](docs/GTT-UI.png) with standalone Angular components and shared CSS design tokens, without an additional UI framework.

- Compact top header with a guitar mark and application name/version (click to return to Practice), an open center area reserved for future tools, an EN/IT language selector, and a Settings gear icon toggle on the right. Navigation is local UI state; dead placeholder tabs have been removed.
- Collapsible left **Library** sidebar with Open Tab, **Recent Files**, **Favorites** (star toggle), **Saved Phrases** for the active project, and **Export / Import Project** (`.gtt.json`).
- Right sidebar with **Tracks & Mixer** (expandable song info, mute/unmute, cumulative solo, visibility, and independent track volume) that switches cleanly to the compact **Settings** panel (Appearance + local `.sf2` SoundFonts & Guitar Program Remapping) without hiding or interrupting the open tablature in the center.
- Central alphaTab viewer with Score & Tab, Tab Only, and Notation Only modes; zoom at 75%, 100%, 125%, and 150%; browser fullscreen where supported.
- Permanent bottom transport area with synthesized playback, timeline, A/B loop, speed, and read-only tempo. Master volume is active; the desktop transport uses a compact horizontal layout and wraps on smaller screens.

Settings implements appearance preferences and local `.sf2` SoundFont customization (Base SoundFont + optional Guitar Override with per-program GM `24–31` remapping and active track indicators, persisted in IndexedDB). Playback uses the real alphaTab synthesizer. Real audio backing tracks and Virtual Rig / VST3 hosting remain future work.

On small screens the side panels start collapsed and expand over the workspace. The notation paper retains a minimum width of 720px and scrolls inside the viewer, preserving musical readability without causing horizontal page overflow. The paper stays light in dark mode.

### Appearance

Choose **System**, **Light**, or **Dark** under **Settings → Appearance**. System is the default and follows `prefers-color-scheme`, including changes while the app is open. Explicit selections are saved under `guitar-tab-trainer.theme` in localStorage; blocked storage does not prevent changing appearance for the session.

A small synchronous script in the document head applies the saved/system theme before CSS and Angular, preventing an incorrect initial theme. The Angular theme service maintains it afterwards. All theme colors come from shared CSS variables in `apps/web/src/styles.css`.

### Implemented — M3

- Local Guitar Pro file selection (GP3, GP4, GP5, GPX, GP).
- Score loading and metadata extraction.
- Music notation and tablature rendering.
- Rendering of available tracks with visibility controls independent of audio mute/solo.
- Loading and error states.
- Retry handling and cleanup of previous rendering instances.
- Preservation of original Guitar Pro files.

### Implemented — M4

- Synthesized playback through the public APIs of alphaTab **1.9.0**, without modifications or a fork.
- Play/pause, stop, timeline seek, speed from 25% to 200%, and A/B loops.
- Set A/B at the current position, including during playback. Valid changes preserve playback and keep the position inside the new range; invalid ranges leave the previous loop intact.
- Stop returns to the active range start or the song start. Loop B is exclusive. Small seek rounding comes from the player.
- One authoritative transport state in the framework-independent core; Angular presents its snapshots and forwards commands.
- Local SoundFont, worker, and worklet assets; audio errors keep the score readable. Reopen the file to retry.
- Bidirectional timeline/score seek, including while stopped.
- Independent visibility controls and a track reset action alongside the mixer.
- IndexedDB recovery of the current GP, position, loop, mixer, view and visibility after refresh, without autoplay.
- Optional synchronized fretboard with track selection, note names and guitar position references.
- Effect annotations and animated paths for bends/releases, slides with a destination, and hammer-on/pull-off.

Playback becomes available after audio preparation. Press Play to start from a user gesture. The timeline uses the executed sequence, including repeats; displayed times follow the current playback speed. Use localhost or HTTPS for AudioWorklet.

This is a single-source reference player. No independent Audio Engine or synchronized backing playback has been introduced. The user has given general manual acceptance; detailed acoustic and device-specific checks remain unreported. See [M4 validation](docs/M4_PLAYBACK.md).

### M4 Track Mixer and UI

The core owns mixer state and commands through `MixerController` and `MixerPort`. The adapter alone calls `changeTrackMute`, `changeTrackSolo`, `changeTrackVolume`, and `masterVolume` on alphaTab 1.9.0. Angular only displays snapshots and forwards interactions. There is no custom audio mixer.

- Mute and solo can be active on multiple tracks. Solo is cumulative; an explicitly muted track stays silent even when soloed. Removing the last solo restores the other unmuted tracks.
- Track and master volumes range from 0% to 100%. A new document restores its track volumes from the GP, resets mute/solo, and restores master volume to 100%. View, zoom, theme, language, and navigation changes preserve mixer settings for the current document.
- alphaTab controls MIDI channels: tracks sharing a channel cannot be isolated. Their controls are linked and marked in the UI. The first track in a linked group supplies its initial volume. The original file and musical model remain unchanged.
- Action buttons and controls have native browser tooltips translated with Transloco. Titles update on EN/IT changes; visible text or accessible labels identify controls independently of tooltips. Display timing and touch behavior follow the browser.
- The transport keeps play/pause, stop, timeline, speed, A/B, tempo readout, and master volume. The inactive previous-button placeholder is removed; A/B values and instructions remain accessible. Desktop is one row, with responsive wrapping and larger mobile targets.
- Playback cursors and SVG note highlighting use scoped CSS on the always-light notation paper. The user confirmed the visual feedback during manual testing.

Tests and manual checks are detailed in [M4 playback](docs/M4_PLAYBACK.md). Mixer fixtures are documented in [M4_MIXER.md](tests/fixtures/M4_MIXER.md).

### Internationalization — Implemented

The Angular UI uses Transloco with a runtime EN/IT selector.

Available capabilities:

- English (`en`) as the default and fallback language.
- Italian (`it`) as an additional language.
- Automatic language detection from browser preferences.
- Runtime language switching without reloading the application.
- Local persistence of language preferences.
- Translation of interface labels, controls, status messages, and errors.
- Translation resources stored in local JSON files.

Internationalization is limited to the Angular UI. Imported musical content and tablature metadata are not translated.

Language selection follows this order: a supported saved preference, the first supported entry in `navigator.languages`, then English. Regional variants such as `it-CH` and `en-GB` map to IT/EN; unsupported saved values are ignored.

Explicit choices are stored under `guitar-practice.language` in localStorage. Automatic detection does not save a preference. If storage is blocked or full, switching still works for the current session. The document's `lang` attribute follows the active language.

Translation files are located in `apps/web/public/i18n/en.json` and `it.json`, deployed under `assets/i18n/`. Both small catalogues are loaded from the application's own static server before the UI appears. Missing Italian keys fall back to English. There are no external translation services or persistence plugins. When adding text, update both JSON files and preserve matching interpolation parameters.

Language changes update labels, accessible names, counts, placeholders, and existing loading/error messages without reloading the page or recreating the alphaTab surface. Score titles, artists, track names, filenames, and rendered notation remain unchanged. Empty score titles stay empty in the model; only the UI supplies a translated placeholder.

Core and adapter errors expose language-independent `ScoreLoadError` codes. The UI translates these codes; `ScoreState.message` remains diagnostic information and is not rendered directly. Neither package depends on Angular or Transloco.

The operating system's native file picker retains its browser/system language. The application's file control and messages use the selected UI language.

### Implemented — M5 (Guitar Capture & Play Session)

- Guided IN/OUT measure selection directly on the score, fragment view using public alphaTab APIs, configurable lead-in context bars, and audio count-in.
- Engine-agnostic `AudioToMidiPort` contract in `@guitar-practice/core` with a pure TypeScript DSP engine in `@guitar-practice/audio-engine` (MIT port of Hendrix DSP + Mobile Bonus: `HendrixAudioToMidiEngine`, `MidiRecording.toSmf`, `extractNotes`, live tuner).
- Browser Web Audio capture (`apps/web/src/app/practice/guitar-capture.ts`, independent of Angular) with Monitor Input ON/OFF toggle, live input level/tuner readout, and MIDI capture strictly windowed between Punch-In and Punch-Out.
- Phrase saving, real-guitar take recording (`● Record Take`), and offline variant creation (`+ New Variant` cloning the original GP fragment) without ever mutating the original Guitar Pro file.
- Variant view selector (`Original GP` vs `Take 1`, `Take 2`, ...) and interactive Fretboard editing (click string/fret while paused or stopped to add, move, or remove variant notes) with **Undo / Redo** and dashed ghost markers for differing original GP notes.

### Implemented — M6 (Storage & Projects)

- Domain models, deterministic score identity (`computeScoreContentId`), immutable variant editor with Undo/Redo, and portable `.gtt.json` bundle export/import in `@guitar-practice/study-project`.
- Browser `IndexedDbStudyProjectStore` (`guitar-practice-projects-v1` with `projects`, `scores`, and `media` object stores, separate from M4's current-session recovery database) with transparent fallback to `InMemoryStudyProjectStore`.
- Left Library sidebar wired to persistent projects: **Recent Files**, **Favorites**, **Saved Phrases** (one-click activation), and **Export / Import Project**.

## Local Assets and Offline Operation

Bravura fonts, SONiVOX SF2 with its license, and unmodified alphaTab audio scripts are copied from the installed package into:

`assets/alphatab/`

No runtime resources are loaded from external CDNs.

The production build can be served using a local static server:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory apps/web/dist/web/browser
```

The application works without an Internet connection when served locally with its bundled assets.

It is not currently a Progressive Web App (PWA) capable of offline startup from a previously visited remote website.

## Testing

### Automated Tests

```sh
pnpm test
pnpm typecheck
pnpm build
```

`pnpm test` runs architectural boundary checks and Node.js tests for `core`, `audio-engine`, `study-project`, `alphatab-adapter`, and `web` (including IndexedDB project store, practice session, preferences, and EN/IT translation catalogues).

`pnpm typecheck` validates production TypeScript sources.

Vitest executes TypeScript tests through transformation.

### Browser Tests

Install Playwright Chromium:

```sh
pnpm exec playwright install chromium
```

Run browser tests against the production build:

```sh
pnpm test:browser
```

To run the same scenarios against the development server:

```sh
pnpm build:packages
GUITAR_PRACTICE_TEST_DEV=1 pnpm exec playwright test
```

To use an existing Chromium installation:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

Playwright starts the test server on port 4173 and waits for its readiness message.

In managed sandbox environments, browser tests may require permission to open local ports and launch Chromium.

The Guitar Pro test corpus is documented in [tests/fixtures/alphatab/README.md](tests/fixtures/alphatab/README.md).

Validation results belong to different development stages. The latest H/P
increment passed the build, boundary checks and 16 targeted Node tests.
The last recorded full Chromium suite is historical, with 30 passed and
4 failed after the mixer work. Later targeted runs and positive user testing
do not establish a current full-suite result.

The user confirmed visibility recovery after refresh and the H/P rendering.
For subsequent UI changes, the agreed workflow is build verification and
manual browser testing by the user. Full historical suites should be run
only when relevant to the task. Evidence and open issues are recorded in
[docs/M4_PLAYBACK.md](docs/M4_PLAYBACK.md), with earlier results in
[docs/HISTORY.md](docs/HISTORY.md).

## Architecture

The project separates application logic, alphaTab integration, and presentation.

### `packages/core`

Application state, orchestration, and public contracts.

No dependencies on Angular, alphaTab, or browser DOM APIs.

### `packages/audio-engine`

Pure TypeScript Audio → MIDI DSP engine (MIT port of Hendrix DSP + Mobile Bonus) implementing `AudioToMidiPort` from `@guitar-practice/core`. Includes `HendrixAudioToMidiEngine`, `HendrixProcessor`, `HendrixMidiReader`, `MidiRecording.toSmf`, `extractNotes`, and live tuner analysis.

### `packages/study-project`

Pure TypeScript domain models and logic for M5/M6: `StudyProject`, `PracticePhrase`, `PhraseVariant`, `VariantNote`, `StudyProjectStoragePort`, `InMemoryStudyProjectStore`, immutable fretboard `VariantEditorState` (Undo/Redo), deterministic `computeScoreContentId`, and portable `.gtt.json` bundle export/import.

### `packages/alphatab-adapter`

Implements the core contracts and encapsulates alphaTab through its public APIs.

### `apps/web`

Angular application responsible for presentation, user interaction, internationalization, and composition of the application modules.

No direct alphaTab imports.

The root `App` composes standalone components in `layout/`, `practice/`, and `viewer/`. `ScoreSession` is a UI composition service around the core controllers, adapter, IndexedDB stores, and browser audio capture; it manages presentation commands without adding musical logic to presentational components. Theme and language preferences live in UI services.

The adapter exposes a plain `ScoreViewMode` contract without exporting alphaTab model types. Display changes use public `Staff.showStandardNotation` / `Staff.showTablature`, `settings.display.scale`, `updateSettings()`, and `render()` on the in-memory document. Original GP files are never rewritten. Tracks without strings retain standard notation in Tab Only mode. The deprecated `display.staveProfile` setting is not used.

Shared packages expose only their compiled public entry points through `dist`.

The root `angular.json` configures only `apps/web`. The shared TypeScript packages use `tsc` and are not Angular projects.

Architectural boundaries can be checked with:

```sh
pnpm check:boundaries
```

No backend, native Audio Engine, or desktop runtime has been introduced.

## Known Limitations

- Rendering currently runs on the main thread.
- Performance with large scores has not been measured.
- The verified test corpus covers GP3, GP5, and GP7; GP4 and GPX remain untested.
- Successful SVG rendering and metadata extraction do not guarantee complete fidelity of musical effects.
- Real-guitar audio capture, latency alignment, and Audio → MIDI conversion quality require manual testing and calibration on real instruments/audio interfaces.
- Synchronized external backing audio tracks and Virtual Rig / VST3 hosting are not implemented.
- Historical browser failures and the later refresh-test assertion remain verification debt. See the M4 document for the fixture and selector limitations.
- No native audio device integration or desktop packaging.

## Roadmap

Development milestones and their current status are tracked in [TODO.md](TODO.md).

For the M5/M6 implementation plan, see [docs/M5_M6_PLAN.md](docs/M5_M6_PLAN.md). Earlier technical history and session handoff notes are preserved in [docs/HISTORY.md](docs/HISTORY.md) and [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md).

## Licensing

The project's own distribution license has not yet been selected.

alphaTab is an independent project licensed under MPL-2.0. Its licensing and attribution requirements must be respected.

Third-party assets and dependencies retain their respective licenses.

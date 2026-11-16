# Guitar Tab Trainer

Guitar Tab Trainer is a modular guitar practice application built around [alphaTab](https://github.com/CoderLine/alphaTab).

The project uses a pnpm monorepo with an Angular UI, a UI-independent TypeScript orchestrator, and alphaTab integrated as an external dependency through a dedicated adapter.

The goal is to provide an environment for learning guitar parts through interactive tablatures, synchronized backing tracks, and eventually live guitar audio.

The project is also an experiment in AI-assisted software development, with human supervision of architectural decisions and validation.

**Current status:** M0–M3, EN/IT localization, and the responsive UI shell are implemented and verified. M4 has not started.

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

- Header with a guitar mark, application name/version, active section, EN/IT selector, and collapsible mobile navigation.
- Practice, Library, Projects, Virtual Rig, and Settings navigation. Navigation is local UI state; no URL router is introduced for unfinished sections.
- Collapsible file sidebar with Open Tab. Recent files and favorites are explicitly unavailable placeholders, with no fictitious entries or musical-library persistence.
- Central song information and alphaTab viewer. The viewer stays mounted across section changes, retaining the loaded document and renderer.
- Score & Tab, Tab Only, and Notation Only modes; zoom at 75%, 100%, 125%, and 150%; browser fullscreen where supported.
- Track panel populated exclusively from the loaded score. Mute, solo, and volume controls are disabled and marked as unavailable.
- Permanent bottom transport area. Playback, timeline, loop A/B, speed, tempo, and master volume remain disabled even after a score is loaded.

Library, Projects, and Virtual Rig pages explain that their future functionality is unavailable. Settings currently implements appearance preferences. There is no simulated playback, mixer, rig, library, or project workflow.

On small screens the side panels start collapsed and expand over the workspace. The notation paper retains a minimum width of 720px and scrolls inside the viewer, preserving musical readability without causing horizontal page overflow. The paper stays light in dark mode.

### Appearance

Choose **System**, **Light**, or **Dark** under **Settings → Appearance**. System is the default and follows `prefers-color-scheme`, including changes while the app is open. Explicit selections are saved under `guitar-tab-trainer.theme` in localStorage; blocked storage does not prevent changing appearance for the session.

A small synchronous script in the document head applies the saved/system theme before CSS and Angular, preventing an incorrect initial theme. The Angular theme service maintains it afterwards. All theme colors come from shared CSS variables in `apps/web/src/styles.css`.

### Implemented — M3

- Local Guitar Pro file selection (GP3, GP4, GP5, GPX, GP).
- Score loading and metadata extraction.
- Music notation and tablature rendering.
- Rendering of all available tracks.
- Loading and error states.
- Retry handling and cleanup of previous rendering instances.
- Preservation of original Guitar Pro files.

The player is currently disabled. Audio playback, SoundFonts, and an independent Audio Engine have not yet been implemented.

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

### Planned Features

- Synthesized playback of musical tracks.
- Synchronized backing track playback.
- Playback speed, navigation, and practice loops.
- Independent audio source mixing.
- Live guitar input through audio interfaces or USB modelers.
- Local study projects and session persistence.
- Future pitch processing and virtual guitar rigs.

## Local Assets and Offline Operation

Bravura fonts and their licenses are copied from the installed alphaTab package into:

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

`pnpm test` runs architectural boundary checks and Node.js tests for the core, alphaTab adapter, UI language preferences, and translation catalogues.

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

UI shell validation: build, typecheck, architectural boundary checks, **45 automated tests**, and **21 Chromium browser tests** passed. The browser suite includes all previous M3/localization scenarios plus navigation, disabled future controls, panel collapse, theme persistence/system changes, theme initialization before Angular, display modes, zoom, fullscreen where available, and mobile rendering. Desktop dark and mobile screenshots were inspected. Browser tests use the production build on port 4173; the user's hot-reload server on port 4200 is left running.

Internationalization validation: 35 automated tests and 14 Chromium tests against the production build passed, together with build, typecheck, and a frozen-lockfile offline installation. Browser scenarios cover detection, persistence, runtime switching, English fallback, unavailable storage, translated errors, and unchanged score metadata/rendering. The additional development-server check was skipped because port 4200 was occupied by the user's active hot-reload session; that server was left running.

## Architecture

The project separates application logic, alphaTab integration, and presentation.

### `packages/core`

Application state, orchestration, and public contracts.

No dependencies on Angular, alphaTab, or browser DOM APIs.

### `packages/alphatab-adapter`

Implements the core contracts and encapsulates alphaTab through its public APIs.

### `apps/web`

Angular application responsible for presentation, user interaction, internationalization, and composition of the application modules.

No direct alphaTab imports.

The root `App` composes standalone components in `layout/` and `viewer/`. `ScoreSession` is a UI composition service around the existing core controller and adapter; it manages presentation commands without adding musical logic to presentational components. Theme and language preferences live in UI services.

The adapter exposes a plain `ScoreViewMode` contract without exporting alphaTab model types. Display changes use public `Staff.showStandardNotation` / `Staff.showTablature`, `settings.display.scale`, `updateSettings()`, and `render()` on the in-memory document. Original GP files are never rewritten. Tracks without strings retain standard notation in Tab Only mode. The deprecated `display.staveProfile` setting is not used.

Shared packages expose only their compiled public entry points through `dist`.

The root `angular.json` configures only `apps/web`. The two TypeScript packages use `tsc` and are not Angular projects.

Architectural boundaries can be checked with:

```sh
pnpm check:boundaries
```

The existing `audio-engine` and `study-project` directories are reserved for future development and are not currently active workspace packages.

No backend, native Audio Engine, or desktop runtime has been introduced.

## Known Limitations

- Rendering currently runs on the main thread.
- Performance with large scores has not been measured.
- The verified test corpus covers GP3, GP5, and GP7; GP4 and GPX remain untested.
- Successful SVG rendering and metadata extraction do not guarantee complete fidelity of musical effects.
- No synthesized playback or backing track support yet.
- No persistent study-project storage or SQLite integration; only UI language and appearance preferences are persisted.
- No native audio device integration.
- No desktop packaging.

## Roadmap

Development milestones and their current status are tracked in [TODO.md](TODO.md).

The next major milestone is synthesized audio playback, followed by validation of synchronized playback across multiple audio sources.

## Licensing

The project's own distribution license has not yet been selected.

alphaTab is an independent project licensed under MPL-2.0. Its licensing and attribution requirements must be respected.

Third-party assets and dependencies retain their respective licenses.

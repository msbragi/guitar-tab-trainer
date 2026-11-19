# Guitar Tab Trainer — Project Instructions

## Project

Modular guitar practice application, developed primarily by AI agents.

Primary technologies:
- Angular for UI/UX
- TypeScript for application orchestration
- alphaTab as an external dependency
- Audio engine independent of the UI framework
- Local-first storage using filesystem and SQLite

Development environment: Debian WSL2.

## Architecture principles

1. Treat alphaTab as a black box. Use its public APIs through a dedicated adapter.
2. Do not modify or fork alphaTab without explicit approval.
3. Keep the orchestrator independent of Angular and desktop frameworks.
4. Keep audio processing independent of UI components.
5. Prefer small modules with explicit interfaces and responsibilities.
6. Avoid unnecessary abstractions, dependencies and infrastructure.
7. Keep original Guitar Pro files unchanged.
8. Design for offline operation.

## Angular component layout

Give each Angular component its own directory with matching TypeScript, HTML
and CSS or SCSS files. Reference the template and stylesheet with
`templateUrl` and `styleUrl` (or `styleUrls` for multiple stylesheets).
Keep templates and styles out of component decorators. Keep shared and global
styles in the application stylesheet.

## Development workflow

Follow these distinct phases:

1. Analysis
2. Planning
3. Implementation
4. Testing and review

Do not advance between phases without explicit approval.

Before implementation:
- Examine the relevant existing code.
- Identify affected modules and interfaces.
- Describe the proposed changes and risks.
- Update TODO.md with the agreed tasks.

During implementation:
- Work only within the approved scope.
- Do not introduce unrelated refactoring.
- Add appropriate automated tests.
- Preserve module boundaries.

After implementation:
- Execute relevant tests.
- Report results and limitations.
- Update TODO.md.
- Summarize completed work and remaining tasks.

## AI collaboration

Act as a technical collaborator, not merely a code executor.

Challenge questionable architectural choices and propose alternatives when justified.

Never silently introduce major architectural decisions.

Do not claim functionality is verified unless it has been tested.

## Current priorities

1. Establish Angular + TypeScript workspace.
2. Integrate alphaTab through public APIs.
3. Implement score loading and tablature rendering.
4. Validate external audio integration and shared transport.
5. Introduce backing track synchronization and playback controls.

VST3 hosting, pitch detection and advanced rig processing are out of scope for the initial milestone.

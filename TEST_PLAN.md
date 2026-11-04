# Test Plan and Phase 0 Validation

**Assessment date:** 2026-11-02
**Scope:** Existing test evidence, Phase 1 toolchain validation, DATA-01 model validation, and the proposed quality strategy for the roadmap.
**Tester availability:** A Tester agent is now available and completed a bounded QA-01 run in the integrated Windows Electron/Chromium browser. Phase 0 used Backend and Frontend read-only assessments; QA-01 remains in progress because the run found an open defect and did not cover the full browser/export matrix.

## Phase 0 validation performed

| Check | Result | Evidence / limitation |
|---|---|---|
| Full specification review | **Passed** | Complete `PROJECT_SPEC.md` reviewed before code inspection. |
| Frontend specialist assessment | **Completed** | Read-only review of app/components/hooks/timeline and associated styling. Evidence is reflected in `ARCHITECTURE.md` and `FEATURE_INVENTORY.md`. |
| Backend/media specialist assessment | **Completed** | Read-only review of import/export/media flow and backend/persistence presence. No backend was found. |
| `npm test` | **Passed** | Five tests passed, zero failed. These cover timeline duration, sequence duration, reorder immutability, split ranges, and platform preset IDs/dimensions (`src/services/timeline.test.mjs`). |
| `npm run build` | **Failed** | `tsc -b` completed; Vite then failed while loading PostCSS because module `tailwindcss` could not be found. No application files were changed to work around this. |
| `npm ls --depth=0` | **Failed** | npm reports installed `vite@5.4.21` and `@vitejs/plugin-react@4.7.0` as invalid against manifest ranges `^8.3.5` and `^6.1.2`; Tailwind is not an installed direct dependency. |
| Browser workflow/export | **Not run** | No live browser or real media export was executed in discovery. Browser/codec claims and full workflows remain unverified. |

## Phase 1 validation performed

| Check | Result | Evidence / limitation |
|---|---|---|
| Clean dependency install | **Passed** | `npm ci` completed successfully from the updated lockfile on Node 24.12.0; `package.json` declares the supported range `^20.19.0 || >=22.12.0`, matching Vite 8.3.5 and React plugin 6.1.2. |
| `npm test` after clean install | **Passed** | Five tests passed, zero failed; same timeline-helper scope as the Phase 0 suite. |
| `npm run build` after clean install | **Passed** | `tsc -b` and Vite 8.3.5 production build completed; CSS and JS assets emitted to ignored `dist/`. |
| `npm ls --depth=0` after clean install | **Passed** | Direct dependencies resolve without invalid/missing entries: React 18.3.1, Vite 8.3.5, React plugin 6.1.2, Tailwind 3.4.19, PostCSS 8.5.32, Autoprefixer 10.6.2, TypeScript 5.9.3. |
| `git diff --check` | **Passed** | No whitespace errors in tracked changes. |
| Browser workflow/export | **Partially run** | See QA-01 evidence in `TEST_RESULTS.md`: 15 cases in integrated Electron/Chromium, 10 passed, 1 failed, 1 blocked, 3 not tested. One MP4 Blob decoded in-browser; downloaded-file inspection and the native browser matrix remain outstanding. |

## DATA-01 validation performed

| Check | Result | Evidence / limitation |
|---|---|---|
| Project model round-trip and validation | **Passed** | Added seven Node tests for JSON round-trip, empty state, malformed JSON/schema/version, duplicate IDs, missing asset references, invalid timestamps/numeric/settings values, and rejection of runtime File/object-URL fields. Existing five timeline tests remain intact. |
| `npm test` | **Passed** | 12 tests passed, zero failed (7 project-model tests and 5 timeline-helper tests). |
| `npm run build` | **Passed** | TypeScript and Vite 8.3.5 production build passed after DATA-01. |
| `npm ls --depth=0` | **Passed** | No invalid or missing direct dependencies. |
| `git diff --check` | **Passed** | No whitespace errors in current tracked changes. |
| Browser persistence and editor integration | **Not implemented / not run** | DATA-01 is schema-only. Browser-local persistence semantics are unresolved; DATA-02 remains gated. |

## Current coverage and gaps

The automated suite exercises pure timeline helpers and the JSON project model only. It does not establish persistence or cross-browser behavior end-to-end. QA-01 characterized a subset of workflows in the integrated Windows Chromium/Electron browser and generated/decoded one MP4 Blob, but the filesystem download was not captured and important input/browser cases remain untested. The run found `BUG-QA01-001`, a video preview in-point mismatch. Treat source-level feature findings as current implementation evidence, not full acceptance evidence. Detailed run evidence is in `TEST_RESULTS.md`; QA-01 remains **IN_PROGRESS** pending defect retest and the gaps listed there.

## Required baseline test matrix

Before feature work changes behavior, establish repeatable cases for:

1. **Import:** valid audio/image/video; unsupported/corrupt files; duplicate files; cancellation/removal; object-URL cleanup; large-file feedback.
2. **Existing editing:** sequence ordering, trim bounds, midpoint split, still duration, transforms, fades, clip removal, dimensions/frame-rate selection.
3. **Preview:** play/pause/seek, clip boundaries, source video seeking, audio-video sync, end-of-audio behavior, missing/failed assets.
4. **Export:** supported MIME selection; complete recording/download; playability; selected dimensions/fps; duration/audio; failures and cleanup; inactive-tab/long-export limitations.
5. **Build and dependency integrity:** clean install, typecheck, production build, dependency consistency.
6. **Accessibility/responsiveness:** keyboard access, focus, semantic labels, responsive editor controls and later landing-page layouts.

Record browser/OS/version, source fixtures, selected settings, expected result, actual result, and artifacts for each export test.

## Progressive acceptance coverage

| Capability | Minimum validation before acceptance |
|---|---|
| Project model | Schema validation, stable IDs, serialization round-trip, unknown/invalid version handling, migration fixtures. |
| Persistence/recovery | Save/open/reload, interrupted write or storage unavailable, missing media, project integrity after failed export. |
| Editing history | Ordered undo/redo of each supported edit command, bounded history behavior, no unintended cross-project state mutation. |
| Multi-track timeline | Unit tests for coordinate/time conversion and operations; UI tests for selection/drag/trim/split/snap; overlap and boundary cases. |
| Preview synchronization | Browser tests with known-duration audio/video; seeks at clip boundaries; measured sync tolerance; decode errors and timeouts. |
| Renderer/export | Actual output opened/probed for duration, dimensions, frame rate where measurable, audio presence/sync, transitions/effects; cancel/failure cleanup. |
| Audio/titles/effects | Project persistence and preview/output parity fixtures for every supported control; test unsupported parameters and fallbacks. |
| Marketing | Link/CTA checks, responsive viewport set, keyboard/contrast/accessibility checks, verified screenshot and claim review. |
| Release | Full critical workflow regression on approved browser matrix; no open critical defects; documented limits and launch-stage approval. |

## QA operating recommendations

- Prefer pure unit tests for project/time math and edit commands; add component tests for UI state/validation; add browser-level tests for media APIs and downloaded outputs.
- Use small, redistributable fixtures with known durations/dimensions and deterministic expectations. Do not commit proprietary or user media.
- Make browser API/codec support an empirical matrix, not an inference from `MediaRecorder.isTypeSupported`.
- Track flakiness and timing tolerances explicitly; do not claim frame accuracy without a measurement strategy.
- Validate cleanup after success, cancellation, import failure, decode failure, and export error to prevent leaked streams/object URLs.
- Run focused tests during each feature increment and full critical-flow regression before release.

## Outstanding test blockers

1. No repository-managed browser/E2E harness is available. QA-01 used the integrated browser automation tool for a one-off run; the Tester role is available for follow-up.
2. Target browser/OS matrix and project persistence scope have not been approved (`PROD-01`).
3. QA-01 generated and browser-decoded a 67,542-byte MP4 Blob, but the integrated browser did not expose a download event or persisted file for independent on-disk inspection. No FFmpeg/FFprobe binary was available.

## QA-01 baseline characterization

**Run date:** 2026-11-02
**Status:** Partial; detailed results and case-by-case gaps are in `TEST_RESULTS.md`.
**Observed environment:** Windows host, integrated Electron 43.8.3 / Chromium 150.0.7871.250, Node 24.12.0, app package 1.0.0. This is not a native Chrome/Edge/Firefox/Safari compatibility run.

The run exercised synthetic WAV and PNG imports, clip ordering, still-duration adjustment, video trim and midpoint split using a locally generated export-derived MP4, image transforms, audio playback/clip-boundary preview, MP4 Blob generation/decoding, and the simulated canvas-capture failure message. One defect was found: the preview remains at source time 0 when a video clip's in-point is 0.2 seconds, while an in-point of 0.5 seconds seeks correctly. See `BUG_REPORTS.md` (`BUG-QA01-001`).

Do not treat the “Export complete” UI message as proof of a user-download workflow: the output Blob was inspected in-browser, but no downloaded file was obtained. WebM, native target browsers, malformed/unsupported imports, drag-and-drop, and transformed export parity remain untested.

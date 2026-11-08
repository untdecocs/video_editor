# Test Plan and Phase 0 Validation

**Assessment date:** 2026-11-02
**Scope:** Existing test evidence, Phase 1 toolchain validation, DATA-01 model validation, and the proposed quality strategy for the roadmap.
**Tester availability:** A Tester agent completed baseline QA and a portable-project-package validation in integrated Chromium. This file retains the historical assessment below and adds the 2026-11-08 decisions and evidence.

## Production compatibility and portability follow-up — 2026-11-08

**Approved target matrix:** Latest two stable desktop releases of Chrome, Edge, and Firefox on Windows 11; Safari on the current and previous macOS major releases. Mobile/tablet are out of scope. Native Chrome/Edge have only initial-page headless smoke evidence; Firefox/Safari were unavailable. Integrated Electron/Chromium results do not substitute for native-browser validation.

**Other recorded decisions:** Portable downloadable project export/import is required before launch. Commercial scope is free beta with no payments, accounts, or cloud features. Public production is the intended target, but keep the release private until the actual production URL and CTA are supplied. No numeric media limits are approved; the authorized benchmark is for representative evidence and recommendations only. Legal/privacy owner remains unassigned.

**PORT-01 test evidence:** `npm test` passes 69/69 and `npm run build` passes. Node tests cover full project metadata/source-media roundtrip, SHA-256 integrity, malformed/unknown versions, unsafe filenames, MIME mismatches, bad base64/size, missing/extra/duplicate records, an 8 MiB regression case, and non-canonical padding. Tester integrated-Chromium checks covered a synthetic WAV/PNG export Blob, independently calculated media hashes and signatures, new-ID import, metadata/media recovery after reload, malformed-file preservation, and cancellation without modifying the active project. Four browser checks passed; one disk-download event/read-back was blocked by the harness. No downloaded project file was independently inspected.

**Representative package benchmark (not a browser/media-decoder benchmark):** Windows 10 build 19045 x64; AMD Ryzen 5 5500, 12 logical CPUs, 16,168 MiB RAM; Node 24.12.0. Generated silent stereo PCM WAV fixtures at 44.1 kHz/16-bit were 1, 8, and 32 MiB (5.9, 47.6, and 190.2 seconds). Resulting JSON packages were 1.33, 10.67, and 42.67 MiB; build times 53.6, 377.7, and 1,512 ms; parse times 17.5, 106.4, and 283.4 ms; sampled RSS increases 21.5, 123.9, and 377.6 MiB. This single Node environment does not establish practical browser, video-decode, export, or universal media limits. Current internal package safety guards are implementation bounds—not user-approved supported media limits. Do not publish numeric limits without representative native-browser measurement and product approval.

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
| Portable project package | Complete metadata/media roundtrip; format/schema version rejection; filename/MIME/content checks; per-media integrity and byte lengths; missing/extra/duplicate entries; cancel/malformed/quota failures preserve active and saved projects; import uses a distinct saved-project ID; verify downloaded file from disk and reload it. |
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
2. The approved browser/OS matrix is not yet executed end-to-end in native browsers; native Chrome/Edge evidence remains first-screen only and Firefox/Safari are unavailable.
3. QA-01 generated and browser-decoded a 67,542-byte MP4 Blob, but the integrated browser did not expose a download event or persisted file for independent on-disk inspection. The package roundtrip similarly inspected its Blob, not a disk-saved file. No FFmpeg/FFprobe binary was available.
4. No numeric product media limits are approved; the single-machine Node package benchmark is not sufficient to recommend universal or browser-supported caps.
5. Production URL/CTA is still required before release can leave private status; legal/privacy owner is unassigned.

## QA-01 baseline characterization

**Run date:** 2026-11-02
**Status:** Partial; detailed results and case-by-case gaps are in `TEST_RESULTS.md`.
**Follow-up (2026-11-04):** A current-workflow integrated Chromium pass ran 16 checks (12 passed, 1 failed, 3 blocked); the Save As selector failure was fixed and passed a focused 4/4 retest. Timeline marker behavior passed 8/8 focused cases, including undo/redo and persistence/recovery. These were point-in-time counts; see the 2026-11-08 follow-up above and `TEST_RESULTS.md` for current validation. Full QA remains partial because native browser workflows and a disk-saved output file remain unverified. See `BUG_REPORTS.md`.
**MEDIA-01 follow-up (2026-11-04):** Extension/MIME checks and a searchable asset library passed focused synthetic-media Chromium checks; malformed video errors now complete promptly and URLs are cleaned. Video/audio metadata no-event timeouts and cleanup are unit-tested but were not forced in the browser. A valid decodable video fixture and other browsers remain unverified. Latest automated suite: 54/54; build passes.
**PREV-01 follow-up (2026-11-04):** Preview state now distinguishes empty project/gap/hidden track and reports video loading/error/playback rejection; inactive layers pause. Integrated Chromium passed 5 checks and blocked 3 video-specific checks (no decodable video fixture and browser page access issue). No A/V sync or frame-accuracy claim. Latest automated suite: 56/56; build passes; see `TEST_RESULTS.md`.
**Observed environment:** Windows host, integrated Electron 43.8.3 / Chromium 150.0.7871.250, Node 24.12.0, app package 1.0.0. This is not a native Chrome/Edge/Firefox/Safari compatibility run.

The run exercised synthetic WAV and PNG imports, clip ordering, still-duration adjustment, video trim and midpoint split using a locally generated export-derived MP4, image transforms, audio playback/clip-boundary preview, MP4 Blob generation/decoding, and the simulated canvas-capture failure message. One defect was found: the preview remains at source time 0 when a video clip's in-point is 0.2 seconds, while an in-point of 0.5 seconds seeks correctly. See `BUG_REPORTS.md` (`BUG-QA01-001`).

Do not treat the “Export complete” UI message as proof of a user-download workflow: the output Blob was inspected in-browser, but no downloaded file was obtained. WebM, native target browsers, malformed/unsupported imports, drag-and-drop, and transformed export parity remain untested.

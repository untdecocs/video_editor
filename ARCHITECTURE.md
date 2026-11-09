# Architecture Discovery and Recommendation

**Assessment date:** 2026-11-02
**Scope:** Phase 0 review of the current application and the product direction in `PROJECT_SPEC.md`, updated with approved DATA-01 work.
**Status (2026-11-02):** DATA-01 project schema, DATA-02 IndexedDB lifecycle, and HIST-01 edit history are integrated. The app remains a React/Vite client-only editor. Browser-specific storage and export claims remain limited to tested evidence.

## Production-readiness architecture update — 2026-11-09

The application remains a React/Vite client-only editor. Production release metadata is kept in `config/production.json`; private release/privacy approvals and product media decisions are separate from the browser bundle in `config/release-readiness.json` and `config/media-limits.json`. Vite production and private-beta build modes evaluate the readiness records and require protected environment approver allowlists. The default `npm run build` creates an explicitly preview-mode artifact. A local read-only report can be generated with `npm run readiness:dashboard`; it is written outside `dist` and has no approval controls. There is still no hosting provider or deployment workflow in the repository; future deployment automation must use the gated build and enforce host-level access controls for private beta.

Project media remains in browser IndexedDB, subject to quota/eviction and user data clearing. The previous external Google Fonts request has been removed; the app now uses system fonts. The current media extension allowlists and export-format options are centralized in `config/media-limits.json`, but remain marked pending product approval and browser-matrix validation.

## Executive assessment

The repository is a small, client-side **React + TypeScript + Vite** video composition application. It imports local files, keeps the working edit state in React memory, previews a sequential clip list, and renders an export in the browser using Canvas, Web Audio, and `MediaRecorder`. There is no application server, API, database, authentication, or durable project storage in the inspected repository.

The current application is materially narrower than the professional editor and marketing site described in `PROJECT_SPEC.md`. In particular, it has a single ordered visual sequence and one soundtrack rather than a multi-track project, and the project is lost when the page session ends. The existing browser renderer is nevertheless a useful baseline and should be evaluated and improved before considering replacement.

**Phase 0 baseline:** The package manifest and lockfile declared Vite `^8.3.5` and React plugin `^6.1.2`, but the pre-existing `node_modules` contained Vite `5.4.21` and plugin `4.7.0`; Tailwind was absent despite the PostCSS configuration. **Phase 1 update:** FDN-01 added Tailwind CSS 3, PostCSS, and Autoprefixer to the development dependencies and declared the Node range required by Vite 8.3.5. A clean `npm ci`, production build, and `npm ls --depth=0` now pass on Node 24.12.0. `TEST_PLAN.md` records validation evidence.

## Observed architecture

### Runtime and build

- **Application:** React 18 with TypeScript and JSX, bootstrapped from `src/main.tsx` into `src/App.tsx`.
- **Bundler/dev server:** Vite with the React plugin (`vite.config.ts`).
- **Styling:** `src/index.css` imports Tailwind layers; `postcss.config.js` configures Tailwind and Autoprefixer; `tailwind.config.js` is present. Phase 1 added Tailwind CSS 3, PostCSS, and Autoprefixer; clean install and production build pass.
- **TypeScript:** strict mode is enabled, with browser DOM libraries and no application emit (`tsconfig.json`).
- **Supported Node runtime (Phase 1):** `^20.19.0 || >=22.12.0`, matching the locked Vite 8.3.5 and React plugin 6.1.2 requirements (`package.json`).
- **Scripts:** `npm run dev`, `npm run build`, `npm run preview`, and Node's built-in test runner for timeline and project-model tests (`package.json`).
- **Backend/data infrastructure:** none found in the repository configuration or inspected source. Vite's development server is not an application backend.
- **Marketing site:** no separate landing-page implementation or routes were found in the inspected source inventory.

### Current application flow

1. The user selects one audio file and one or more image/video files.
2. `App` owns the current workflow and in-memory project-like state: assets, ordered clips, selected clip, playback position, export settings, and export UI state.
3. `TimelineEditor` exposes clip-level controls and sequence ordering; the preview and settings are composed from the same app-level state.
4. `videoExport.ts` loads the soundtrack and visual assets in the browser, draws frames to a canvas, combines the canvas capture stream with a Web Audio stream, and records the result through `MediaRecorder`.
5. On completion, a Blob URL is downloaded by the browser. The app does not upload media or persist a project to a server.

The Frontend and Backend specialist assessments independently confirmed this client-only flow. Detailed existing capabilities and gaps are in `FEATURE_INVENTORY.md`.

### Media engine and boundaries

The current renderer uses browser-native `HTMLAudioElement`, image/video elements, Canvas 2D, Web Audio, `MediaStream`, `MediaRecorder`, object URLs, and browser downloads. MIME support is selected using `MediaRecorder.isTypeSupported`; that check is not an end-to-end codec or output-playability guarantee. Rendering proceeds in real time against soundtrack playback. Progress is based on elapsed audio playback, and export is not user-cancellable.

Media files and object URLs are transient runtime resources. DATA-01 adds `src/services/project.ts`: a schema-version-1 JSON-safe representation for project identity/timestamps, audio and visual asset metadata, the existing `TimelineClip`/`VisualTransform` edit values, and output settings. Validation rejects unknown fields, invalid values, duplicate IDs, missing visual references, and runtime URL/file fields. It intentionally makes no persistence choice and does not change `App` state. Current risks include unbounded concurrent media loading, no export cancellation, no final-file validation, platform-dependent codec availability, and possible frame timing issues around asynchronous video seeks. No actual browser export compatibility matrix was run.

### Test architecture

Node's built-in test runner now covers five timeline-helper tests and seven project-model tests (serialization round-trip and schema validation). There is no evidenced browser E2E suite, renderer output validation, cross-browser test setup, or backend integration test harness.

## Technical debt and limitations

1. **Build reproducibility:** **Resolved for this environment by FDN-01**; clean-install and build verification passed. Supported Node/CI matrix still needs to be defined and validated.
2. **State concentration:** `App.tsx` owns workflow, edit state, media lifecycle, selection, and export UI state. Specialist review also found alternate preview/audio hooks and components with no other references in `src`; consolidate or remove them only after behavior is characterized.
3. **Persistence limits:** Project metadata and media Blobs now persist in IndexedDB with autosave and latest-project recovery. This is scoped to one browser profile/device, subject to quota/eviction, and does not provide cloud sync or portable project export/import.
4. **Project-model scope:** Version 1 schema is integrated with persistence, but it still models one soundtrack and one ordered visual sequence; multi-track migration/model work remains.
5. **Editor model scope:** one ordered visual sequence and one soundtrack cannot express multiple tracks, clip overlaps, track properties, markers, or track-level edits.
6. **Preview/render contract:** current preview/export behavior should be characterized before extending operations; asynchronous media seeking and differing browser APIs create sync and determinism risks.
7. **Export observability and resilience:** progress does not represent encoding/finalization, cancellation is absent, and the produced file is not reopened/validated.
8. **Media limits:** no explicit file-size, dimension, asset-count, decode-concurrency, or resource safeguards were found in the reviewed pipeline.
9. **Feature/claim accuracy:** the implemented editor does not support the broader professional features listed in the product spec; marketing claims and screenshots must reflect verified functionality only.
10. **Missing operational/security scope:** no backend or authentication exists. If cloud accounts, remote media storage, or public forms are later chosen, security/privacy and deployment requirements must be specified before implementation.

## Recommended architecture (incremental; subject to product decisions)

### Preserve the existing baseline

- Retain the existing React, TypeScript, and Vite architecture, per the user's decision. `PROJECT_SPEC.md` names Angular, but migration is not approved.
- Keep export local and browser-based by default. The current code provides no evidence that a backend renderer is necessary for the existing workflow.
- Do not add a competing media engine before representative export tests establish a need. Evaluate browser APIs, FFmpeg/FFmpeg.wasm, WebCodecs, or server rendering against actual browser/platform support, output requirements, performance, distribution, and licensing constraints.
- Resolve the declared-versus-installed dependency and Tailwind discrepancy as a small, isolated stability task before feature implementation.

### Establish explicit project and media boundaries

The initial storage-agnostic v1 project model now has stable project, asset, and clip identifiers and represents the existing single audio input, sequential visual clips, transforms, and output settings. Extend it only as approved features are implemented. The current v1 does not claim support for tracks, effects, titles, or other unimplemented edit operations.

Keep the model free of `File`, DOM element, `MediaStream`, and object-URL state. Put runtime decoding, asset resolution, and URL lifecycle behind a media-resource layer. The approved direction is browser-local project storage, but exact blob persistence, portability/import-export, recovery, and quota semantics are undecided. Define these before implementing persistence; do not silently imply cloud storage.

### Use one editing description for preview and render

Evolve timeline operations around the project model, with centralized edit commands and history rather than component-specific mutations. Keep preview and export driven by the same clip/effect/transform semantics, with explicit time mapping and synchronization rules. This is necessary for changes to survive export and for undo/redo to restore coherent state.

Maintain a renderer boundary so the current Canvas/MediaRecorder path can be tested and improved without coupling the project schema to one browser API. A future alternative renderer is a measured, explicit decision—not a parallel engine introduced preemptively.

### Separate responsibilities without a rewrite

Incrementally isolate:

- project state and edit commands/history;
- asset metadata and media resource lifecycle;
- timeline geometry and operations;
- preview synchronization;
- export orchestration/progress/errors;
- UI panels and workflow navigation.

Retain existing UI and behavior while adding tested capabilities. Prefer small changes with regression evidence to a wholesale rewrite.

## Decisions needed before dependent implementation

Decisions recorded: retain React; initial target is desktop Chrome, Edge, Firefox, and Safari; project storage is browser-local. The following remain open and must be decided before dependent implementation:

1. **Browser support:** minimum versions and exact supported OS/browser combinations; mobile editing expectations?
2. **Storage semantics:** whether media blobs are retained locally and how; autosave/recovery guarantees; quota handling; project portability/import/export and relinking behavior.
3. **Media limits:** supported file formats, file size, duration, resolution, clip/asset counts, and system requirements.
4. **Export requirements:** target codecs/containers, quality/bitrate controls, maximum duration/resolution, and whether export must work offline or in background.
5. **Public/product scope:** approved availability/CTA, contact/legal ownership, landing-page routes and content.
6. **Commercial model:** explicitly defer pricing/payment UX and claims until decided and implemented.

These are product decisions, not assumptions to bake into Phase 1. See `PROJECT_ROADMAP.md` and `TASKS.md`.

## Evidence and scope

This assessment used the complete `PROJECT_SPEC.md`, repository source/configuration review, Frontend and Backend specialist evidence, and test/build/dependency checks. DATA-01 adds a storage-agnostic schema without UI or persistence integration. `npm test` passes 12 tests, `npm run build` passes, and `npm ls --depth=0` is valid. QA-01 additionally exercised a subset of workflows and decoded one MP4 Blob in integrated Windows Electron/Chromium; it found the open preview trim defect `BUG-QA01-001`. Downloaded-file inspection, native browser compatibility, full export parity, and device-performance study remain outstanding.

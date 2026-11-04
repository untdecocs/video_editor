# Existing Feature Inventory

**Assessment date:** 2026-11-02
**Source of target requirements:** complete `PROJECT_SPEC.md`
**Status definitions:** **Working (limited scope)** = evidenced in source and/or existing tests; **Incomplete** = some usable behavior exists but does not meet the spec; **Missing** = not found in reviewed repository; **Unverified** = implementation claims need runtime/browser validation.

This is a discovery snapshot, not an assertion that browser behavior has passed end-to-end testing. Media and UI evidence was supplied by the Backend and Frontend assessments; test strategy and historical validation are documented in `TEST_PLAN.md`, with QA-01 runtime evidence in `TEST_RESULTS.md`.

## QA-01 runtime evidence (2026-11-02)

The integrated Windows Electron/Chromium browser run confirmed valid synthetic WAV/PNG import, image clip reordering and duration adjustment, video trim and midpoint split controls, preview transform controls, audio playback across an image boundary, and generation/decoding of one MP4 Blob. It also exposed a video-preview in-point mismatch at 0.2 seconds (`BUG-QA01-001`). These are bounded observations, not cross-browser acceptance. The MP4 download artifact itself was not captured; full case details and limitations are in `TEST_RESULTS.md`.

| Area | Current status | Existing behavior/evidence | Gap against spec / next evidence needed |
|---|---|---|---|
| Application and workflow | **Incomplete** | React/TypeScript single-page workflow with steps for soundtrack, visuals, and preview/editing (`src/App.tsx`). | Not the specified professional workspace; no evidenced landing-page routes or marketing sections. Preserve workflow while expanding. |
| Media import | **Incomplete** | Selects one audio file and multiple images/videos; files are used through browser object URLs. | No rich asset metadata, loading-state inventory, folders/collections, search/filter, thumbnail browser, or explicit robust unsupported-format workflow. Validate import errors and formats in browsers. |
| Media library/organization | **Missing** | In-session file/clip state only. | No folders, collections, rename/search, metadata display, proxy media, or durable asset catalog. Removal should remain distinct from deleting originals. |
| Audio tracks | **Incomplete** | One soundtrack controls export duration; video source audio is muted/excluded. | No multiple audio tracks, clip-level trim/split/volume, mute/fades/waveform, track gain, mixing, or audio processing. |
| Video tracks/timeline | **Incomplete** | A sequential clip list with clip reordering, selection, duration/source range, and per-clip controls (`src/components/TimelineEditor.tsx`, `src/services/timeline.ts`). | No multiple tracks, overlaps, track lock/visibility/mute/rename/grouping, timeline ruler/zoom/scroll/timecode, playhead editing, markers, snapping, ripple/roll/linking, or track-level properties. |
| Clip operations | **Incomplete** | Reorder, remove, video trim range, still duration, and midpoint split helper; helper functions have unit tests. | No split-at-playhead, duplication, precise interaction/timing validation, ripple edits, or robust multi-track operations. Current tests validate helpers only. |
| Preview/playback | **Incomplete / unverified** | Composition preview and playback/seek/settings flow are present. | No established frame-accurate timeline synchronization or cross-browser performance guarantee. Frame-by-frame navigation, preview quality, and robust audio/video sync are not evidenced. |
| Transitions | **Incomplete / unverified** | Cut/fade choice is available per clip; renderer draws fade behavior. | No full reusable transition library, configurable transition durations/placement, or cross-browser proof that preview and export match. Wipe/slide/zoom/cross-dissolve are not evidenced. |
| Transformations | **Incomplete** | Fit/fill, zoom, horizontal/vertical position, rotation, and flips are available. | Crop controls, independent scale/position framing, aspect-ratio workflows, and consistent persisted transformations are not evidenced. |
| Text/titles/subtitles | **Missing** | No title-editing UI or title model found. | Text overlays, typography, placement, styling, duration, presets, lower-thirds, captions, and export rendering are absent. |
| Effects/color correction | **Missing** | No effect/color adjustment model or UI found. | Required effects, configurable correction, project persistence, and consistent preview/export rendering are absent. |
| Playback speed | **Missing** | Standard playback controls exist. | Speed changes, reverse, frame stepping, and speed-aware export are not evidenced. |
| Project management | **Working (local/browser scope)** | Versioned metadata and audio/visual source Blobs are persisted in IndexedDB; UI supports naming, save, save-as, open, delete, debounced autosave, and latest-valid-project recovery. Integrated Chromium verified reopen/reload and injected storage-error messaging. | Single browser profile/device; no cloud sync or portable project file; quotas, eviction, and native-browser behavior remain unverified. |
| Undo/redo and shortcuts | **Working (limited scope, integrated Chromium verified)** | Bounded history covers media changes, clip reorder/trim/split/delete, transforms, and output settings; accessible controls and Ctrl/Cmd shortcuts are present. Tester verified 12 scoped browser cases. | Native-browser/macOS shortcut behavior and UI history stress remain unverified; advanced future edit types still need history integration. |
| Export/render | **Incomplete / unverified** | Local browser render uses Canvas capture + Web Audio + `MediaRecorder`, downloads a Blob; offers MP4/WebM choices, 24/30/60 fps, platform/custom dimensions; some errors and elapsed-audio progress are surfaced. | No verified output compatibility matrix, 720p/1080p/4K preset verification, bitrate/quality controls, accurate encoding/finalization progress, cancellation, final-file validation, or evidence that all future effects survive export. 4K/codec/hardware support must not be claimed without tests. |
| Large media/performance | **Unverified / limited** | Browser decodes imported files and renders in real time; no backend processing. | No stated file/asset/duration limits, proxy workflow, bounded loading, memory/performance benchmarks, background render, or tested large-file behavior. |
| Persistence/backend/auth | **Missing** | No application API, database, server-side media processing, or authentication identified. | No cloud account, remote project store, server render queue, or protected shared-project model. Add only if product/storage decisions require them. |
| Landing page/showcase | **Missing** | `index.html` has title and description metadata only. | No marketing experience, verified feature showcase, product screenshots/demo, CTA paths, SEO beyond basic document metadata, or responsive marketing routes. |
| Build and dependency integrity | **Resolved for current environment (verified 2026-11-02)** | Tailwind CSS 3, PostCSS, and Autoprefixer are now declared consistently with the existing Tailwind v3 configuration. A clean `npm ci`, `npm run build`, and `npm ls --depth=0` all pass. | Revalidate in CI and document the supported Node version/runtime when that decision is made. |
| Automated tests | **Incomplete** | Five Node tests cover timeline helpers; seven added Node tests validate project serialization/schema round-trip, invalid documents, references, values, and transient runtime fields. | No UI, browser, media import, preview, export-file, persistence, synchronization, responsive, or cross-browser coverage. |

## Product-spec mapping

The project's required product is substantially broader than the existing implementation. The most important current-versus-required gaps are:

1. **P0 foundations:** reproducible dependency/build setup, behavioral baseline, and a product decision on persistence/target browsers.
2. **Core editing:** versioned project representation, multi-track timeline, accurate clip edits, undo/redo, and synchronized preview.
3. **Reliable output:** export tests and clear browser/format limits before extending the render feature set.
4. **Professional capability:** audio editing, titles, effects/transitions, color correction, playback speed, and media organization.
5. **Commercial presentation:** a truthful, responsive landing page and real demonstrations, followed by legal/privacy work before public launch.

Detailed sequenced work is in `TASKS.md`; milestone acceptance criteria are in `PROJECT_ROADMAP.md`; validation strategy is in `TEST_PLAN.md`.

## Classification caveat

“Working” in this inventory refers to source-level behavior and narrow helper tests, not a claim that complete user workflows or exported files have been verified. In particular, format support, browser compatibility, synchronization, and large-file behavior remain unverified until real browser tests are added and executed.

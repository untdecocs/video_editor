# Project Task Breakdown

**Planning source:** Complete `PROJECT_SPEC.md` plus Phase 0 source and specialist evidence.
**Status key:** `PENDING` = planned/not started; `IN_PROGRESS` = active; `BLOCKED` = prerequisite or decision missing; `IN_REVIEW` = awaiting acceptance; `COMPLETED` = acceptance verified.
**Current state (2026-11-08):** Current `npm test` passes 69/69; `npm run build` passes; `npm ls --depth=0` is clean; `npm audit` reports 0 vulnerabilities. Native Chrome 157.0.8103.38 and Edge 157.0.4341.42 rendered only the production preview's initial editor screen in headless smoke checks. A separate Chrome run observed a synthetic WAV metadata timeout and only verified empty-project metadata across reload; reproduce before classifying it as a product defect. The user approved the target matrix (latest two stable desktop Chrome/Edge/Firefox on Windows 11; Safari on current/previous macOS major releases; no mobile/tablet), portable project export/import REQUIRED before launch, free beta with no payments/accounts/cloud features, and a public-production target that must remain private until the actual URL/CTA is supplied. Numeric media limits are not approved; legal/privacy owner is unassigned. Portable package implementation passed automated checks and an integrated Chromium roundtrip, but a disk-saved package was not independently inspected and the native browser matrix remains open. **NOT READY**; see `LAUNCH_READINESS_REPORT.md`.

## Phase 1 — Foundation and stability

### FDN-01 — Restore a reproducible frontend toolchain

- **Owner:** Frontend (coordinate with DevOps if available)
- **Dependencies:** None
- **Priority / status:** P0 / COMPLETED
- **Description:** Reconcile package manifest, lockfile, and installed Vite/React plugin versions; resolve the missing Tailwind PostCSS dependency or intentionally remove unused Tailwind configuration. Preserve existing application behavior.
- **Deliverables:** Consistent dependency declarations/lockfile and build configuration; documented supported Node version.
- **Acceptance criteria:** From a clean dependency install, TypeScript and production build both pass; `npm ls --depth=0` reports no invalid/missing direct dependencies; the existing UI styling remains intentional and verified.
- **Verified evidence (2026-11-02):** Added Tailwind CSS 3, PostCSS, and Autoprefixer to development dependencies, consistent with the existing Tailwind v3 directives/configuration. Declared Node `^20.19.0 || >=22.12.0` to match Vite 8.3.5 and React plugin 6.1.2 engine ranges. `npm ci` succeeded on Node 24.12.0; `npm test` passed 5/5; `npm run build` passed with Vite 8.3.5; `npm ls --depth=0` reported no invalid dependencies; `git diff --check` passed. Only `package.json` and `package-lock.json` changed for this task.

### QA-01 — Characterize existing editor workflows

- **Owner:** Tester; PM coordinates follow-up
- **Dependencies:** None
- **Priority / status:** P0 / IN_PROGRESS
- **Description:** Establish repeatable baseline tests for import, ordering, trim/split, transform controls, preview, and current export success/failure paths before changing behavior. Include representative image, video, and audio fixtures that are legally usable.
- **Deliverables:** Browser/manual regression matrix, test fixtures or fixture-generation instructions, baseline defects/limitations.
- **Acceptance criteria:** Each current user workflow has steps, expected result, browser/OS target, and pass/fail evidence; exported fixture can be checked for playable output, duration, dimensions, and audio presence where supported.
- **Progress/evidence:** Tester ran 15 baseline cases in integrated Electron 43.8.3 / Chromium 150 on Windows: 10 passed, one failed, one blocked, and three were not tested. Synthetic WAV/PNG import, clip order/duration, trim/split, transform controls, playback across a still boundary, and decoding an MP4 render Blob were exercised. Frontend fixed `BUG-QA01-001`; Tester independently verified paused in-points 0, 0.1, 0.2, 0.4, and 0.5 seconds, plus metadata, split/second-asset seeks, and playback in 9/9 retest cases. Automated tests pass 14/14 and the production build passes. Downloaded-file inspection, native Chrome/Edge/Firefox/Safari, malformed/large media, WebM/alternate settings, and export source-range parity remain untested. Full evidence is in `TEST_RESULTS.md` and `BUG_REPORTS.md`; QA-01 remains in progress.
- **Latest follow-up (2026-11-04):** A bounded integrated Chromium pass covered 16 current-workflow checks: 12 passed, 1 failed, and 3 were blocked by native file-picker/download/browser availability. It found `BUG-DATA-01` (Save As created a copy but left the saved-project selector on the prior project), which was fixed and independently retested in 4/4 focused browser cases. Timeline markers were independently tested in 8/8 focused cases, including undo/redo, save/reload, and open. These follow-ups do not complete QA-01: no downloaded export file was available for independent decode/duration/audio checks, and native target browsers remain unavailable. Details are in `TEST_RESULTS.md` and `BUG_REPORTS.md`.

### PROD-01 — Decide supported product and persistence scope

- **Owner:** Product/PM with Backend and Frontend consulted
- **Dependencies:** None
- **Priority / status:** P0 / IN_PROGRESS
- **Description:** Resolve target browser/OS versions, local versus downloadable versus cloud project persistence, supported project/media limits, availability/CTA, and commercial boundaries. Explicitly decide whether the existing React stack is retained; do not presume a backend.
- **Deliverables:** Recorded product decisions and open questions, scope/acceptance boundaries, browser compatibility target.
- **Acceptance criteria:** Storage and target platform choices are approved; any unapproved choices are marked as blockers for dependent tasks; no unapproved pricing, accounts, remote rendering, or feature claims are assumed.
- **Decision record:** User approved retaining React, browser-local project storage, and desktop Chrome, Edge, Firefox, and Safari as the initial target browsers.
- **Decision record (2026-11-08):** Support the latest two stable desktop releases of Chrome, Edge, and Firefox on Windows 11, and Safari on current/previous macOS major releases; mobile/tablet are out of scope. Portable project package export/import is required before launch. Commercial scope is free beta with no payments, accounts, or cloud features. Public production is the intended target, but keep release private until the real URL/CTA is supplied. Representative media benchmarking and conservative recommendations are authorized; no numeric limits are approved.
- **Remaining blockers:** Run the approved native browser/OS matrix; reproduce or explain the synthetic WAV metadata timeout; decide and approve numeric media limits only after representative measurements; supply production URL/CTA and explicit release authorization; assign legal/privacy owner. The completed package still needs independent inspection from a downloaded file.
- **Status rationale:** Product scope decisions are recorded, but launch acceptance is incomplete. DATA-02 remains local-first IndexedDB (metadata plus source Blobs, autosave and latest-valid recovery); no cloud sync, storage guarantee, payment, account, or unsupported public claim is inferred.

## Phase 2 — Project model and work-safety

### DATA-01 — Define versioned project and asset model

- **Owner:** Frontend (Backend consulted if persistence/API is approved)
- **Dependencies:** Initial direction from PROD-01; final storage semantics are not required for this storage-agnostic schema.
- **Priority / status:** P0 / COMPLETED
- **Description:** Define serializable project, asset, track, clip, timeline, and output-setting types with stable IDs and schema versioning. Separate durable metadata from browser `File` objects, DOM resources, and object URLs.
- **Deliverables:** Project schema/types, validation and migration policy, representative serialized fixtures.
- **Acceptance criteria:** A fixture round-trips with clip order, source timing, transforms, audio/output settings and version preserved; invalid/unknown schema handling is explicit; no transient browser resources are serialized.
- **Verified evidence (updated 2026-11-04):** `src/services/project.ts` now validates and migrates schema v1–v4. Project data includes versioned tracks, clips, title overlays, and timeline markers alongside JSON-safe audio/visual asset metadata and output settings; runtime files/object URLs remain excluded. Tests cover round-trip, strict validation, v1/v2/v3 migrations, invalid references/values, and marker persistence shape. The current automated suite passes 43/43 and the production build passes.

### DATA-02 — Implement project save, open, and recovery

- **Owner:** Frontend; Backend only if PROD-01 approves a service
- **Dependencies:** DATA-01, FDN-01; user approved retaining React and browser-local storage for this implementation.
- **Priority / status:** P0 / IN_REVIEW
- **Description:** Implement lifecycle operations and autosave/recovery for the approved storage model. Provide relinking or clear missing-media handling where project references depend on local files.
- **Deliverables:** Save/open/save-as/recovery flows, persistence adapter, failure/permission feedback, tests.
- **Acceptance criteria:** A saved project reopens with supported edits intact; reload/recovery behaves as documented; missing assets and storage failures produce actionable messages; originals are not deleted by project asset removal.
- **Implementation evidence (2026-11-02):** Added IndexedDB project records containing validated DATA-01 metadata and audio/visual source Blobs, project list/name/open/save-as/delete controls, debounced local autosave and latest-project recovery on reload, and managed object-URL cleanup when replacing/removing media. Missing/corrupt media, malformed records, unavailable storage, and quota/write errors are surfaced without replacing the open in-memory project. Removing a clip explicitly reports that the original file is untouched; deleting a saved project removes only its project record and stored copies. `npm test` passed 21/21; `npm run build` passed. A focused integrated Electron/Chromium browser run verified media persistence, autosave/manual save, reload recovery, explicit reopen, deletion, and actionable feedback when an injected IndexedDB SecurityError occurs while edits are open; details are in `TEST_RESULTS.md`. Native Chrome/Edge/Firefox/Safari and natural browser-storage failure modes remain unverified, so this remains IN_REVIEW.
- **Nov 4 follow-up:** Save As selection mismatch was fixed by selecting the newly created project after refreshing the list. Independent Chromium regression verified Save As creates and selects the copy, Open follows the selected record, and Delete confirmation/deletion target the selected record (**4/4 passed**). Native browsers, natural quota/eviction, interrupted writes, and portable export/import remain open; DATA-02 stays IN_REVIEW.
- **Documented implementation assumptions:** Local-first and one browser profile/device; project metadata and source media Blobs are persisted together in IndexedDB; current project edits autosave after a short debounce and the most recently updated valid project is offered/restored automatically at startup; saved project records can be deleted independently. Portable package behavior is tracked separately in PORT-01. Browser quotas and eviction may apply; users should retain original source files and backups. No product media limit is approved.

### PORT-01 — Implement portable project package export/import

- **Owner:** Frontend; Tester validates independently
- **Dependencies:** DATA-01, DATA-02
- **Priority / status:** P0 / IN_REVIEW — implementation complete; release validation remains
- **Description:** Provide a self-contained, downloadable project file containing every current project metadata field and all source-media bytes. Import validates format/version, schema, names, MIME/extension, sizes, media records, and SHA-256 integrity before saving under a new ID and applying; the active project and existing saved projects must survive cancellation or failure.
- **Deliverables:** Browser-native versioned JSON `.stillwave.json` package service, accessible export/import UI, automated integrity/safety tests, browser roundtrip and downloaded-file evidence.
- **Acceptance criteria:** Complete metadata/media roundtrip; malformed, unsupported-version, corrupt, incomplete, duplicate, unsafe-name, or mismatched content fails with actionable feedback; failed/cancelled imports do not replace active work or saved records; valid import persists as a distinct project and reloads; existing IndexedDB data remains readable; no third-party dependency is added without justification.
- **Verified evidence (2026-11-08):** `npm test` 69/69 and `npm run build` pass. Unit tests cover every current document field, media bytes, SHA-256, parser versions, malformed base64 and sizes, MIME/name safety, missing/extra/duplicate records, and refusal to overwrite an existing ID. Integrated Chromium verified synthetic WAV/PNG export Blob hashes, new-ID import, metadata/media persistence and reload, malformed-file preservation, and user cancellation. Local Node synthetic stereo PCM WAV packaging passed 1/8/32 MiB cases after fixing a former 8 MiB regex stack overflow. An actual downloaded file was not independently read back. Internal package guards (256 MiB/file, 512 MiB/project media, 800 MiB import file) are implementation safeguards, **not approved product media limits**; representative browser memory tests and owner approval remain outstanding.

### HIST-01 — Add centralized editing history and shortcuts

- **Owner:** Frontend
- **Dependencies:** DATA-01
- **Priority / status:** P1 / COMPLETED
- **Description:** Route supported edit operations through reversible commands or equivalent history, with practical limits and an accessible shortcut reference.
- **Deliverables:** Undo/redo state model, keyboard handling, shortcuts documentation/UI, unit tests.
- **Acceptance criteria:** Trim, split, move, delete, transform, and supported property changes undo/redo in order without losing unrelated project state; history limits are bounded and documented; shortcuts do not hijack browser/system controls unexpectedly.
- **QA verification (2026-11-02):** Independently exercised the integrated editor in the VS Code browser at `http://127.0.0.1:5173/` (Windows user-agent; Electron 43.8.3 / Chromium 150.0.7871.250; Node v24.12.0). Verified accessible Undo/Redo labels and initial/empty/open/new disabled states; audio import; Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y; text-input shortcut isolation; image/video reorder; video trim and split; transform and output-preset undo/redo; and deletion undo/redo followed by successful video and audio playback from restored Blob URLs. Saved-project Open reset history while restoring media, and New reset history after a fresh edit. **12 scoped browser cases passed, 0 failed.** `npm test` passed 28/28 and `npm run build` passed. The history cap is 50 snapshots in the app and service tests cover limit eviction; the cap was not stress-tested through 50 UI actions. See the HIST-01 section in `TEST_RESULTS.md` for steps and evidence.
- **Scope limitations:** Only the integrated Electron/Chromium runtime was available and used; native Chrome, Edge, Firefox, Safari, macOS Command-key behavior, and persisted-download/FFprobe validation were not tested. No product code was changed during this QA run. These gaps do not invalidate the exercised HIST-01 workflows but are not cross-browser or export-release evidence.

## Phase 3 — Core editing and preview

### TIME-01 — Establish multi-track timeline model and navigation

- **Owner:** Frontend
- **Dependencies:** DATA-01
- **Priority / status:** P1 / IN_REVIEW
- **Description:** Introduce video/audio tracks, track ordering/properties, timeline coordinates, playhead/timecode, zoom, and scroll while maintaining a usable path for existing single-sequence projects.
- **Deliverables:** Timeline model/UI, compatibility migration from existing sequence, unit/component tests.
- **Acceptance criteria:** A project supports multiple video and audio tracks; users can select tracks/clips and navigate at the agreed precision; zoom/scroll/timecode remain coherent; existing sequence projects retain clip order and timing.
- **Independent QA evidence (2026-11-02):** Focused integrated-browser testing verified v1-to-v2 migration/reopen, video-track create/select/rename/lock/hide, cross-track clip drag, overlapping-layer preview, in-range navigation, split-at-playhead with undo/redo, autosave/reload, and an in-memory MP4 export Blob decode. A separate soundtrack-boundary retest imported a synthetic 4-second WAV and two stills, verified visuals remain positioned/visible beyond the audio end, ruler and playhead clamp at 4 seconds, the end marker and warning state the current-iteration playback/export limit, normal in-range seek/playback, overlapping preview, and save/reload. `TIME01-NAV-001` can move from **BLOCKED** to **PASS**. `npm test` passed 33/33 and `npm run build` passed. Full steps and observed results are in `TEST_RESULTS.md`.
- **Open acceptance / status rationale:** The UI explicitly supports only one soundtrack; multiple audio clips/tracks remain unimplemented. Dragging a clip horizontally to reposition it remains untested (the numeric timeline-position field was used). Native Chrome/Edge/Firefox/Safari and independent downloaded-file/export inspection remain unverified. Export evidence is limited to a decoded in-memory Blob and does not establish saved-file/export parity. TIME-01 and the professional timeline therefore remain **IN_REVIEW**, not COMPLETED, until scope and remaining criteria are accepted and tested.

### TIME-02 — Implement accurate clip and track operations

- **Owner:** Frontend
- **Dependencies:** TIME-01, HIST-01
- **Priority / status:** P1 / IN_REVIEW
- **Description:** Implement playhead-based trim/split, move/reorder, duplicate, delete, clip snapping, markers, and prioritized track lock/visibility/mute/rename controls. Defer ripple/roll/group/link behavior until core operations are reliable.
- **Deliverables:** Timeline interaction controls, edit commands, edge-case tests.
- **Acceptance criteria:** Operations respect track constraints and defined time precision; snapping can be enabled/disabled predictably; edits do not mutate source media; undo/redo restores each operation.
- **Marker implementation and QA (2026-11-04):** Added global markers (stable ID, bounded time, required 80-character label), add-at-playhead, accessible rename/delete, and click-to-seek. Markers participate in history/autosave and persist in schema v5; v1–v4 projects migrate with no markers. Integrated Chromium QA passed 8/8 scenarios for add/render/seek/rename/delete/undo/redo/reload/open, and the unit suite covers validation and migration. Markers are now implemented and exercised; full TIME-02 remains **IN_REVIEW** because not all track controls, native browsers, or saved exports have been verified.
- **Still-duration implementation and QA (2026-11-04):** Still clips now offer **Match soundtrack** or **Custom duration**. Match uses the decoded soundtrack duration and updates when a soundtrack is replaced; custom duration is numeric, 0.1s minimum, and bounded by the 24-hour project timeline (remaining time after clip position), not a 30-second slider. A custom visual may extend past the soundtrack; export still ends at the soundtrack boundary. If duration is unknown or audio is removed, the last usable still duration is retained and match selection is disabled until a decoded duration is available. Schema v5 persists the mode; v1–v4 clips migrate as custom without changing their stored still duration. Integrated Chromium QA passed 5/5 cases using synthetic 40s and 55s WAV files, including match, 45s custom, soundtrack replacement, and save/reload. Unit tests cover long durations, unknown audio, replacement, limits, video duration, and schema migration. `npm test` passes 58/58; production build and `git diff --check` pass. No full export or native-browser test was run; TIME-02 remains **IN_REVIEW** for the pre-existing track-control and platform/export gaps.
- **Still-duration implementation and QA (2026-11-04):** Still clips now offer **Match soundtrack** or **Custom duration**. Match uses the decoded soundtrack duration and updates when a soundtrack is replaced; custom duration is numeric, 0.1s minimum, and bounded by the 24-hour project timeline (remaining time after clip position), not a 30-second slider. A custom visual may extend past the soundtrack; export still ends at the soundtrack boundary. If duration is unknown or audio is removed, the last usable still duration is retained and match selection is disabled until a decoded duration is available. Schema v5 persists the mode; v1–v4 clips migrate as custom without changing their stored still duration. Integrated Chromium QA passed 5/5 cases using synthetic 40s and 55s WAV files, including match, 45s custom, soundtrack replacement, and save/reload. Unit tests cover long durations, unknown audio, replacement, limits, video duration, and schema migration. A matched still split is now converted into two custom segments preserving the split, so later soundtrack replacement does not reset both halves; this is covered by a regression test. `npm test` passes 59/59; production build and `git diff --check` pass. No full export or native-browser test was run; TIME-02 remains **IN_REVIEW** for the pre-existing track-control and platform/export gaps.
- **Independent QA verification (2026-11-02):** On integrated Electron 43.8.3 / Chromium 150.0.7871.250 on Windows, tested with a synthetic 4-second WAV and two synthetic stills. Verified time-axis dragging with grab-offset preservation; snap off/on and 0.1-second placement; cross-track movement; locked-source and locked-destination rejection; duplicate ID/property preservation and adjacent placement; overlap layer ordering; duplicate undo/redo; local autosave/reload; and the soundtrack-end clamp/indicator. Latest valid case statuses: 13 total, 9 PASS, 0 FAIL, 0 BLOCKED, 4 NOT TESTED. `npm test` passed 36/36 and `npm run build` passed. Full evidence is in `TEST_RESULTS.md`.
- **Open acceptance / status rationale:** Remains **IN_REVIEW**, not COMPLETED. User-created markers are now implemented and passed focused Chromium QA; some track mute/rename workflows and multiple audio tracks remain unverified/unimplemented. Ripple/roll/group/link remain deferred. Native Chrome/Edge/Firefox/Safari and independent saved-export validation remain untested. An initial overlapping-clip drag attempt targeted the wrong clip and caused cascading test assertions; retargeted tests and the persistence read after autosave verified the requested operations with no reproducible product defect.

### PREV-01 — Synchronize preview to project timeline

- **Owner:** Frontend
- **Dependencies:** DATA-01, TIME-01
- **Priority / status:** P1 / IN_REVIEW
- **Description:** Define deterministic project-time-to-source-time mapping for images, video, audio, transitions, and gaps; make preview reflect timeline changes and playback controls.
- **Deliverables:** Preview synchronization layer, error/loading states, seek/playback tests.
- **Acceptance criteria:** Seeking, playback, clip boundaries, and supported overlaps map to expected source time; representative video/audio remain synchronized within an agreed tolerance; failures/timeouts do not leave stale playback state.
- **Implementation evidence (2026-11-04):** Existing source mapping and seek correction are retained; preview now reports loading/unavailable/decode-error/playback-blocked video states, pauses inactive layers, distinguishes empty projects from gaps/hidden tracks, and maintains title-only preview. Automated tests pass 56/56; build passes. Integrated Chromium QA first passed empty/gap/hidden states, title-only, overlapping image layer order, soundtrack play/end behavior, and error feedback (5 pass). A follow-up generated a decodable 320×180, 4.03-second MP4 from synthetic WAV/PNG through the app renderer and passed 8/8 cases: paused in-point mapping (0.5s), timeline seek mapping (1.2s timeline → 1.7s source), two playback samples (video/audio offset 78–94ms behind expected 0.5s), clip-range exit, and malformed-video error/retry while retaining existing media. The fixture is renderer-derived and visually static; measured playback is not a formal synchronization guarantee because no tolerance is approved. No source code changed. Native browser, independent moving-video fixture, long-run sync, and downloaded-export validation remain open; PREV-01 stays IN_REVIEW.

### MEDIA-01 — Improve asset library and import validation

- **Owner:** Frontend
- **Dependencies:** DATA-01
- **Priority / status:** P1 / IN_REVIEW
- **Description:** Add asset metadata/loading states, usable search/filter and organizational affordances, import validation, and safe removal. Prioritize thumbnail/metadata extraction only after profiling the chosen browser APIs.
- **Deliverables:** Asset-library UI/model, validation feedback, tests for invalid and removed assets.
- **Acceptance criteria:** Supported asset types and limitations are visible; rejected files have actionable feedback; removing an asset does not silently delete the original; loading/error states are clear and resource URLs are cleaned up.
- **Implementation evidence (2026-11-04):** Added extension/MIME-hint validation for the listed audio/image/video extensions (not a codec support guarantee), actionable errors, visual import progress/failure handling, and a searchable per-project library showing name/type/size and duration when available. Removing a visual removes its dependent clips and records undo; audio/visual removal preserves original source files and URLs are cleaned up. Malformed visual and audio metadata reads are bounded by 12-second waits with listener/source cleanup; existing audio is retained on failed replacement. Unit suite passes 54/54; build passes. Integrated Chromium QA verified audio/image acceptance, unsupported/mismatched rejection without losing project state, corrupt-image rejection, search-only filtering, remove/undo, save/reload persistence, still-duration N/A, and prompt malformed-video error handling/URL cleanup. The browser test triggered a native decode error rather than the no-event timeout; timeout behavior is unit-tested. A genuinely decodable video fixture and native-browser import matrix remain unverified; MEDIA-01 stays IN_REVIEW.

## Phase 4 — Rendering and professional editing

### REND-01 — Stabilize renderer against the project model

- **Owner:** Frontend/media-processing specialist; Backend only if an approved server renderer is required
- **Dependencies:** DATA-01, QA-01
- **Priority / status:** P0 / PENDING
- **Description:** Preserve the browser renderer initially, but consume the project model and centralize time mapping/transform/effect semantics shared with preview. Add bounded resource loading and well-defined cleanup.
- **Deliverables:** Renderer boundary, automated or repeatable output checks, documented browser limits.
- **Acceptance criteria:** Existing supported composition exports remain available; output timing and supported transforms match project state; assets are cleaned up on failure; no engine replacement is adopted without comparative evidence.

### REND-02 — Add reliable export controls and output validation

- **Owner:** Frontend
- **Dependencies:** REND-01, FDN-01, QA-01
- **Priority / status:** P0 / PENDING
- **Description:** Add cancellation, phase-aware progress/error reporting, safe retry, export settings validation, and real output verification across the approved browser matrix. Determine whether resolution/quality controls can be supported by the selected engine.
- **Deliverables:** Export lifecycle UX, compatibility results, output fixtures/report, recovery tests.
- **Acceptance criteria:** Cancel/failure cleans media tracks and does not change project data; progress/error messages represent actual lifecycle; verified output plays and matches selected settings; unsupported settings/codecs are blocked or explained rather than advertised.

### EDIT-01 — Complete framing and transformation controls

- **Owner:** Frontend
- **Dependencies:** PREV-01, REND-01
- **Priority / status:** P1 / PENDING
- **Description:** Add crop/framing and aspect-ratio behavior to existing fit/fill/zoom/position/rotation/flip controls.
- **Deliverables:** Transform property model and UI, preview/render tests.
- **Acceptance criteria:** Transformations can be previewed, saved, reopened, and reproduced in export; common aspect ratios and custom ratio constraints are tested.

### AUDIO-01 — Add multi-track audio editing

- **Owner:** Frontend
- **Dependencies:** TIME-01, REND-01
- **Priority / status:** P1 / PENDING
- **Description:** Implement audio clip placement, trim/split, clip and track volume, mute/fades, preview, and waveforms as feasible; profile processing before advanced audio features.
- **Deliverables:** Audio clip/track controls, waveform strategy, sync tests.
- **Acceptance criteria:** Multiple supported audio clips/tracks can be edited; volume/fades persist and render; audio/video synchronization remains within agreed tolerance; unsupported processing is clearly excluded.

### TEXT-01 — Add editable titles and text overlays

- **Owner:** Frontend
- **Dependencies:** DATA-01, TIME-01, REND-01
- **Priority / status:** P1 / IN_REVIEW
- **Description:** Add a title/text clip model and contextual text controls; prioritize static title styling and duration before animation/templates.
- **Deliverables:** Text clip UI/model, renderer integration, representative export tests.
- **Acceptance criteria:** Text content, styling, positioning, and duration persist and appear in both preview and exported file; unsupported fonts/styles have clear fallback behavior.
- **Implementation evidence (2026-11-04):** Static title overlays are editable with text, time range, position, system font family, size, weight, alignment, color, background, and shadow controls. They are part of versioned project data, undo/redo, autosave/recovery, timeline selection, composition preview, and browser renderer drawing. Integrated Chromium QA confirmed title timing/preview behavior and export UI completion; title model tests pass. No persisted output file was captured to verify rendered title pixels, so TEXT-01 remains IN_REVIEW until export parity is independently checked. Animation, templates, and subtitle/caption workflows remain out of scope.

### FX-01 — Add transitions, effects, and color adjustments

- **Owner:** Frontend
- **Dependencies:** DATA-01, PREV-01, REND-01
- **Priority / status:** P1 for basic fade/cross-dissolve; P2 for broader effects
- **Status:** PENDING
- **Description:** Introduce serializable, parameterized effects and transitions, then implement the agreed initial library and basic color controls consistently in preview/export.
- **Deliverables:** Effect/transition model and controls, renderer parity fixtures.
- **Acceptance criteria:** Supported effects are editable/removable, saved/reopened, and visibly rendered in export; preview and output use the same parameter semantics; expensive features have defined limits.

### PLAY-01 — Add speed and frame-navigation controls

- **Owner:** Frontend
- **Dependencies:** PREV-01, REND-01
- **Priority / status:** P2 / PENDING
- **Description:** Implement frame stepping, preview quality and playback speed; evaluate reverse playback separately for feasibility.
- **Deliverables:** Playback controls, timing tests, explicit support limits.
- **Acceptance criteria:** Playback speed does not alter source media; supported speed changes produce expected preview and exported duration; frame navigation follows the agreed timebase.

## Phase 5 — Product marketing

### WEB-01 — Approve messaging and design direction

- **Owner:** Product/PM and Frontend
- **Dependencies:** PROD-01, verified feature inventory
- **Priority / status:** P1 / PENDING
- **Description:** Approve product identity, truthful positioning, actual availability/CTA, visual direction, and content ownership. Do not invent testimonials, contacts, pricing, or unsupported capability.
- **Deliverables:** Approved content/design brief and list of permitted claims.
- **Acceptance criteria:** Every planned claim maps to verified functionality or is clearly labeled upcoming; availability and CTA destination are real; legal/contact content has an identified owner.

### WEB-02 — Build responsive landing page and showcase

- **Owner:** Frontend
- **Dependencies:** WEB-01, FDN-01; actual product captures depend on verified UI
- **Priority / status:** P1 / PENDING
- **Description:** Implement an initial landing experience in the existing app architecture with hero, real editor showcase, verified features, workflow, audience/use cases, FAQ, CTA, and footer. Add separate routes only where justified.
- **Deliverables:** Responsive page/components, actual screenshots/demo assets, navigation/SEO checks.
- **Acceptance criteria:** Links and CTA work; visuals depict real behavior; desktop/mobile and keyboard accessibility are checked; unsupported features, pricing, contact, and social links are not implied.

### WEB-03 — Prepare public-launch privacy and legal requirements

- **Owner:** Product/legal owner (not currently available); Frontend supports implementation
- **Dependencies:** PROD-01, WEB-02
- **Priority / status:** P0 before public launch; otherwise PENDING
- **Description:** Approve accurate data-handling, privacy, terms, and public-form requirements for the actual storage/distribution model.
- **Deliverables:** Approved policy/content, required routes/links/forms and handling rules.
- **Acceptance criteria:** No invented legal claims; published content matches actual media storage and processing; forms are protected and have a responsible contact before public launch.

## Phase 6 — Integrated QA and release readiness

### QA-02 — Run cross-workflow, compatibility, and regression testing

- **Owner:** Tester (not available in current environment); interim owner: PM/manual QA
- **Dependencies:** FDN-01, DATA-02, TIME-02, PREV-01, REND-02, relevant feature tasks
- **Priority / status:** P0 / PENDING
- **Description:** Verify actual editing workflows, save/recovery, synchronization, export, responsive marketing, and supported browser/platform matrix.
- **Deliverables:** Test report with environment, fixtures, output evidence, defects, and limitations.
- **Acceptance criteria:** All critical workflows pass; output files are validated; no critical defects remain open; known limitations and unsupported configurations are explicit.

### REL-01 — Prepare demonstration/release candidate

- **Owner:** PM coordinating Frontend, Backend if applicable, and Tester when available
- **Dependencies:** QA-02, WEB-02, WEB-03 for public launch
- **Priority / status:** P0 / PENDING
- **Description:** Review feature claims, documentation, screenshots/demo project, known limitations, deployment and launch-stage requirements.
- **Deliverables:** Release-readiness checklist, demo materials, release notes and deployment instructions.
- **Acceptance criteria:** Evidence supports each public claim; environment and limitations are documented; release stage is explicitly approved. Build success alone does not constitute launch readiness.

## Ownership and parallelization notes

- The current application is client-only. Do not assign server/database/API implementation until `PROD-01` establishes a need.
- `FDN-01`, `QA-01`, and `PROD-01` can start independently.
- `DATA-01` is the shared contract prerequisite for persistence, history, timeline, media, and richer edit data.
- Once that contract is approved, `DATA-02` and `HIST-01` can proceed alongside separately owned timeline/model UI work; integrations must use the same contract.
- `PREV-01` follows initial timeline/project contracts. `REND-01` depends on the model and baseline tests; downstream effects/audio/title tasks share its render contract.
- Marketing planning can run in parallel after claims are approved, but real screenshots and release claims depend on implemented/verified behavior.
- Tester is available and has produced bounded integrated Chromium evidence. Do not mark QA-01 complete until the open defect is retested and the required workflow/browser/export gaps are resolved or explicitly accepted.

# Project Roadmap

**Planning basis:** `PROJECT_SPEC.md` in full, current repository evidence, and read-only Backend/Frontend assessments.
**Current status (2026-11-08):** `npm test` 69/69 and `npm run build` pass; `npm ls --depth=0` is clean; `npm audit` reports 0 vulnerabilities. User-approved target: latest two stable desktop Chrome/Edge/Firefox on Windows 11 and Safari on current/previous macOS major releases; mobile/tablet out of scope. Portable project package export/import is required before launch and is implemented; integrated Chromium roundtrip passed, but downloaded-file inspection and native matrix validation remain outstanding. Commercial scope is free beta with no payments/accounts/cloud. Public production is intended, but release must stay private until the actual URL and CTA are supplied. No numeric media limits are approved; the authorized Node benchmark is not sufficient to establish universal/browser caps. Legal/privacy owner remains unassigned. A native Chrome synthetic-WAV metadata timeout needs reproduction. Official status is **NOT READY**; see `LAUNCH_READINESS_REPORT.md`.

## Product and technical direction

Deliver the current editor incrementally into a reliable browser-first editor, then present verified capabilities through a polished marketing experience. Preserve the existing React application and local browser renderer unless test evidence or an explicit product decision supports a change. Do not start a framework or rendering-engine rewrite as a default response to the breadth of the specification.

The current application has no backend. User decisions are to retain React; target the latest two stable desktop Chrome/Edge/Firefox releases on Windows 11 and Safari on current/previous macOS major releases; and exclude mobile/tablet. DATA-02 provides browser-local IndexedDB storage (project metadata and source media Blobs, autosave, latest-valid recovery) subject to browser quota/eviction. PORT-01 adds required portable JSON project export/import as a separate user-controlled file. Commercial scope is a free beta with no payments, accounts, or cloud features. Public production is the intended destination, but keep release private until the real URL/CTA is supplied. No numeric media limits have been approved; do not infer a storage or performance guarantee.

## Priority definitions

| Priority | Meaning for this roadmap |
|---|---|
| **P0 – Critical** | Build/release blockers, data integrity, core project/export reliability, or decisions that block dependent work. |
| **P1 – High** | Essential usable editing and launch-presentation capabilities. |
| **P2 – Medium** | Advanced professional editing, broader presentation, and optimization. |
| **P3 – Low** | Optional capabilities, polish, or commercial features without an approved requirement. |

## Milestones

### Phase 0 — Discovery and Technical Assessment — **Complete**

**Outcome:** Understand the starting product before implementation.

**Completed evidence:** Full spec review; source/configuration and feature inventory; Frontend and Backend assessments; test/build/dependency checks; architecture, inventory, roadmap, task, and test-plan documentation; subsequent Tester browser evidence for the baseline, DATA-02, and HIST-01. Cross-browser and full export validation remain outstanding.

**Acceptance criteria**

- Existing architecture and current behavior are documented with source evidence.
- Implemented, incomplete, missing, and unverified capabilities are distinguished.
- Current processing and export limitations are explicit.
- Proposed tasks, dependencies, ownership, and acceptance criteria are recorded.
- No product code was changed during discovery.

### Phase 1 — Foundation and Stability — **P0; do first**

**Scope:** Restore a reproducible build; establish test ownership and regression evidence; decide supported browsers and persistence/distribution scope; record current export behavior and failure limits.

**Current checkpoint (2026-11-08):** FDN-01 and DATA-01 are complete; DATA-02 remains in review for broader persistence/failure coverage. QA-01/PROD-01 remain in progress. PORT-01 implementation and unit tests are complete, with integrated Chromium roundtrip evidence; disk-saved package inspection and all native target-browser workflow testing remain open. The browser/OS target, mobile/tablet exclusion, portability requirement, and free-beta/no-payments/accounts/cloud scope are approved. Numeric media limits are not approved; intended public-production release remains private until URL/CTA arrives; legal/privacy owner is unassigned. `npm test` 69/69, production build, dependency-tree check, and dependency audit pass. These do not establish full launch compatibility.

**Acceptance criteria**

- A clean install using the committed dependency lockfile has a successful typecheck and production build in the chosen supported Node environment.
- Dependency declarations and installed/locked versions are consistent; Tailwind is installed/configured or its unused configuration is intentionally removed.
- Existing timeline behavior has regression tests and a runnable browser-workflow baseline.
- Supported browser/OS targets and persistence expectations are approved or explicitly marked as open product decisions.
- No unsupported codec, resolution, or performance claims are made.

### DATA-01 — Project schema only — **Complete**

At the user's direction, the versioned project/asset schema was implemented separately from storage. `src/services/project.ts` uses the existing timeline clip/transform types and includes schema validation plus JSON parsing/serialization; focused tests are in `src/services/project.test.mjs`. DATA-02 implementation and its conservative storage assumptions are recorded below. Multi-track behavior remains out of scope.

### DATA-02 — Local project persistence — **Implementation in review**

IndexedDB stores validated project metadata and the project's audio/visual source Blobs together. The UI provides project naming, save, save-as, open, delete, debounced autosave, and latest-project recovery after reload. Runtime `File` values and object URLs are recreated on open; URLs are tracked and revoked on replacement, removal, or teardown. Storage errors, malformed records, and unavailable/corrupt media retain the current in-memory project and provide feedback. Deleting a saved project removes that project's local copies only; removing a clip does not delete the user's original source file.

**Assumptions and limitations:** One local browser profile/device; no cloud sync or guaranteed storage reservation; browser quota and eviction can apply. Portable export/import is implemented separately in PORT-01. Users should keep originals and backups. Adapter and URL lifecycle tests pass in Node; integrated Chromium verified reload/recovery, but native browsers, natural quota/eviction and interrupted-write behavior remain outstanding.

### PORT-01 — Portable project package — **Implementation complete; validation in review**

The app exports a versioned `.stillwave.json` containing the complete current schema and embedded source media, with SHA-256 verification per media record and strict version, schema, filename, MIME, size, and record validation. Import media is checked before application, saved to IndexedDB under a fresh project ID, and only then opened; cancellation and errors leave current edits and prior saved projects intact. There is no new dependency. Automated tests pass, and integrated Chromium verified a synthetic WAV/PNG roundtrip, metadata and media hashes, imported-project reload, malformed-file preservation, and cancellation.

**Remaining validation:** The browser harness did not expose a disk-saved download for independent read-back. Native target browsers are not available for this run. Node packaging measurements on one machine show substantial base64/memory overhead; current 256 MiB/file, 512 MiB/project media, and 800 MiB import-file guards are implementation safety bounds, not approved product limits. Do not claim universal media limits; obtain browser/device measurements and product approval.

### Phase 2 — Project Model and Work-Safety Foundations — **P0/P1; DATA-01 complete, DATA-02 implementation in review**

**Scope:** DATA-01 provides a versioned serializable schema. DATA-02 implements local persistence/recovery and remains in review for broader browser/storage coverage. HIST-01 is implemented with bounded snapshots, edit restoration and shortcuts; integrated checks cover current operations. The local-first persistence behavior above is the conservative approved default pending additional platform details.

**Acceptance criteria**

- Projects serialize and reopen without losing clip order, source ranges, transforms, output settings, and any supported edit fields.
- Runtime files, object URLs, and DOM resources are not serialized as project metadata.
- Schema versions can be validated and migrated or rejected with an actionable message.
- Save/reopen/recovery behavior is explicit, tested, and consistent with approved storage scope.
- Undo/redo restores tested edit commands without corrupting project or asset state.

### Phase 3 — Core Editing and Preview — **P1**

**Scope:** Multi-track timeline foundations, accurate clip operations, track controls, snapping/markers as prioritized, and preview synchronization against the project model.

**Implementation update (2026-11-04):** Visual multi-track foundations and persistent global timeline markers are implemented. Marker add/seek/rename/delete, undo/redo, save/reload, and open passed 8/8 integrated Chromium scenarios. Still clips support Match soundtrack and Custom duration; matching updates on soundtrack replacement, custom numeric durations above 30 seconds are accepted up to the 24-hour project timeline limit, and schema v5 migrates v1-v4 still durations as custom. Focused Chromium QA passed 5/5 using 40s/55s synthetic soundtracks. An unknown duration retains the last usable duration and disables matching until metadata is available; custom clips may outlast audio, while export continues to end with audio. Multiple audio tracks are not implemented, and track-control, native-browser, and downloaded-export acceptance remains open.

**Adjacent media-library increment (2026-11-04):** MEDIA-01 now has local import validation, bounded audio/video metadata reads, and searchable current-project asset listing with safe removal/history. It remains in review pending valid video-decoder and native-browser checks.

**Acceptance criteria**

- Users can create and edit projects with multiple visual/audio tracks within the agreed initial scope.
- Timeline interactions support tested clip placement, trim, split, move, selection, and navigation at defined precision.
- Audio and video remain synchronized in representative source files and timeline operations reflect in preview.
- Track-level controls and undo/redo behave consistently.
- Timeline interactions remain responsive within stated supported media/device limits.

### Phase 4 — Reliable Rendering and Editing Capabilities — **P0/P1, iterative**

**Scope:** Stabilize the existing browser renderer against the project model; implement export cancellation/error/finalization behavior and actual output verification. Add transformation and audio/title/effect capabilities in increments, using shared preview/export semantics.

**Acceptance criteria**

- Exported output is opened/probed by automated or repeatable manual tests and matches project timing, dimensions, and supported audio/video behavior.
- Export progress distinguishes render/recording from finalization where technically available; errors are actionable and cancellation cleans up resources.
- Browser/OS/format combinations are tested; claims are limited to verified combinations.
- Every implemented effect/transition/title/adjustment is represented in project data and visible in exported output.
- Failed/aborted export does not discard or alter the saved project.

### Phase 5 — Marketing Experience — **P1 after claims and assets are truthful**

**Scope:** Implement a responsive landing page/product showcase in the existing frontend architecture. Prefer a single-page experience first unless navigation/content needs justify separate routes. Use actual screenshots/demonstrations and only verified feature claims.

**Acceptance criteria**

- Landing page communicates product purpose, current verified capabilities, and real availability.
- CTA/navigation targets work; no nonfunctional demo controls or invented pricing, testimonials, contact details, or unsupported comparisons.
- Responsive layouts, keyboard navigation, contrast, basic SEO, and page performance are checked.
- Pricing/payment is excluded until approved; privacy/terms and data-handling answers are approved before public launch.

### Phase 6 — Integration, Release Readiness, and Demonstration — **P0**

**Scope:** Run cross-workflow regressions, fix critical defects, verify documentation and truthful marketing claims, and prepare a demonstration/release candidate.

**Acceptance criteria**

- Critical editing, save/reopen, preview, and export workflows pass on the agreed browser matrix.
- No unresolved critical defects; known limitations and minimum system requirements are documented.
- Marketing links, real assets, legal/privacy requirements, and public claims are reviewed.
- Product screenshots/demo projects reflect behavior that actually exists.
- Release readiness is approved against the agreed launch stage; a successful build alone is insufficient.

## Dependency-aware sequencing and parallel work

### Can run in parallel

- Resolve the toolchain/build blocker and define a baseline manual/automated test matrix.
- Product decisions about storage, supported platforms, and commercial scope can proceed while build stabilization is underway.
- After the project model contract is agreed, timeline UI, persistence implementation, and test fixtures can proceed in separate ownership areas.
- After a shared edit/render contract exists, media-library UI and renderer reliability work can proceed in parallel if file ownership is kept separate.
- Marketing layout/visual exploration can begin after product identity and factual messaging are approved; actual screenshots and specific claims must wait for real product evidence.

### Must be sequential

- Do not implement persistence before the storage/distribution decision and project schema.
- Do not build multi-track timeline operations against an unstable or implicit project model.
- Establish edit commands and shared preview/render semantics before claiming that effects, transitions, or titles survive export.
- Verify real browser export output before advertising codecs, 4K, hardware acceleration, or quality guarantees.
- Run integrated QA after component workflows are integrated; rerun regressions after fixes.
- Final screenshots, demo recordings, public feature pages, and launch-readiness claims follow verified functionality.

## Risks and decision gates

| Risk / gate | Impact | Mitigation / required action |
|---|---|---|
| Declared toolchain does not match installed packages; Tailwind is missing. | Build reproducibility and all future CI work are blocked. | Resolve as first implementation task; verify from clean install, not only local cached dependencies. |
| Spec names Angular while product is React. | Unnecessary migration could disrupt behavior and consume time. | Preserve React as default; ask for explicit approval before framework migration. |
| Browser recorder support varies by browser/OS. | Export formats, quality, and failure modes may differ. | Define browser targets; test actual files and report verified combinations only. |
| In-memory project state is not durable. | User work can be lost on reload/close. | Decide local/download/cloud persistence, then deliver versioned project/save/recovery ahead of advanced editing. |
| Professional features expand the edit model and renderer. | Preview/export divergence and state corruption. | Shared project model, edit commands, and preview/export parity tests before extending effects. |
| Large media strains browser memory/CPU. | Unresponsive tabs, decode failures, unusable exports. | Set explicit support limits; measure representative media; bound decode concurrency and add user feedback. |
| Native browser matrix and persisted export-file inspection remain unavailable in the current run. | Important browser-specific and downloaded-output defects may remain undetected. | Schedule native browser/device execution and obtain a downloaded file for independent inspection; keep codec claims scoped to demonstrated results. |
| Marketing/commercial requirements are intentionally open. | False claims, unsupported contact/pricing/legal statements. | Require approved messaging and legal/product owners; do not invent details. |

## Task tracking

`TASKS.md` is the actionable backlog and source of task-level dependencies, ownership, status, deliverables, and acceptance criteria. Foundation/model/history work is complete or in review; visual timeline operations, markers, and static titles are implemented with bounded Chromium evidence but still have explicit acceptance gaps. Rendering, richer audio/media workflows, marketing, and release tasks remain pending or gated by dependencies/product decisions. Phase 0 discovery itself is complete; the full product is not release-ready.

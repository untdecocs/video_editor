# Stillwave Social Video Studio — Production Launch Readiness

**Assessment date:** 2026-11-08  
**Scope:** Point 4, “Close product and compatibility gaps”; production-readiness evidence and launch gates only. This is not a plan to implement every professional-editor feature in `PROJECT_SPEC.md`.  
**Decision:** **NOT READY for an official public or commercial production launch.**  
**Release instruction:** Public production is the intended target, but **KEEP RELEASE PRIVATE** until the real production URL and approved CTA are supplied. This is not authorization to expose or announce the product.
**Assessment status:** **PARTIALLY COMPLETED** — user scope decisions are recorded and project package export/import is implemented, but browser, media, legal, URL/CTA, and release validation gates remain open.

## Executive assessment

The current React application builds and its automated suite passes (**69/69**). Native Chrome and Edge both rendered the production preview’s initial editor screen in headless smoke checks. A small integrated-Chromium viewport check found no document-width overflow at the tested widths. A versioned JSON project package now exports the complete project document and source media and imports it as a new local project after validation.

That is not sufficient launch evidence. The user-approved browser/OS matrix has not been exercised end-to-end: native Firefox and Safari were unavailable, and native Chrome/Edge evidence remains first-screen smoke only. The integrated Chromium package roundtrip passed, but the browser harness did not expose a disk-saved download for independent inspection. A tester also observed a synthetic WAV metadata timeout in isolated native Chrome. That single observation is **not yet a confirmed product defect**, but it must be reproduced or explained before claiming reliable native-Chrome media import. The isolated run verified an empty project’s name/record persisted across reload, not recovery of media or edits.

The actual production URL/CTA is still missing, the legal/privacy owner is unassigned, and no numeric product media limits have been approved. A Node package benchmark shows substantial memory overhead as media grows; it is not sufficient to set universal browser media limits. Commercial scope is approved as a free beta with no payments, accounts, or cloud features. No storage guarantee or broader compatibility claim is inferred.

## Current evidence

| Area | Evidence on 2026-11-08 | Readiness interpretation |
|---|---|---|
| Automated tests | `npm test`: **69 passed, 0 failed** after adding package validation and an 8 MiB regression case for the parser’s former stack-overflow bug. | Pass for repository unit/service tests; not an end-to-end release suite. |
| Build and dependency integrity | `npm run build` passed; `npm ls --depth=0` is clean; `npm audit` reported **0 vulnerabilities**. | Current Node 24.12.0 snapshot; re-run on the release candidate. |
| Native browser smoke | Windows Chrome **157.0.8103.38** and Edge **157.0.4341.42** loaded the production preview (`http://127.0.0.1:4173/`) in isolated headless runs. Both produced the expected title and a React-rendered editor root with project controls and the audio-import step. | Initial-page rendering only. No native-browser media editing, persistence, download, or export claim follows from this smoke test. |
| Approved browser/OS target | Latest two stable desktop releases of Chrome, Edge, and Firefox on Windows 11; Safari on the current and previous macOS major releases. Mobile/tablet are out of scope. | Approved target only; the full matrix is not tested. Firefox/Safari were unavailable; native Chrome/Edge evidence is first-screen smoke, not workflow validation. |
| Responsive/accessibility spot check | Integrated Electron/Chromium at 320, 375, 390, 768, and 1280 CSS-pixel viewport widths: document/body scroll widths did not exceed the viewport; one `main` and one `h1` were present; project-name and audio file controls had accessible names. | Narrow spot check of the initial page only. Not a WCAG audit, screen-reader/keyboard-flow audit, zoom test, or assessment of the editor timeline at small widths. |
| Native-Chrome media observation | In a separate tester run using Chrome 157 and a synthetic 3-second PCM WAV, audio metadata did not arrive before the app’s timeout; the audio element remained at `readyState=0`. The app did not accept the soundtrack, so media-containing recovery and export were not reached. | Reproduction-needed blocker. Fixture, automation/environment, and product causes are not yet distinguished. |
| Persistence/reload | Existing integrated Electron/Chromium evidence covers project/media save, autosave, reload recovery, reopen, and failure feedback. The 2026-11-08 isolated Chrome run confirmed only that an empty project name/record persisted after reload. Natural quota/eviction, interrupted writes, crash/power-loss recovery, and native-browser media recovery are unverified. | Limited to recorded scenarios; do not promise recovery from crashes or eviction. |
| Output/export | Historical integrated Chromium runs decoded in-memory MP4 render Blobs. No downloaded export file was independently inspected. The 2026-11-08 Chrome follow-up did not reach export. FFmpeg/FFprobe were unavailable. | End-to-end file delivery, actual on-disk decode/metadata, audio presence/sync, title/transform parity, and supported settings remain unverified. |
| Project package | Portable `.stillwave.json` export/import is implemented without a new dependency. It includes all current project metadata and source media as base64 with SHA-256 per-media integrity verification; imports strictly validate and save under a fresh ID before applying. Automated tests pass; integrated Chromium verified roundtrip, metadata/media hashes, reload recovery, malformed-file preservation, and cancellation. | Implementation complete; download-to-disk independent inspection and native target-browser validation remain outstanding. A failed import keeps current edits open. The project document is schema-validated but is not cryptographically signed; media digests detect payload corruption, not provenance/authenticity. |
| Package size/memory benchmark | Local Node roundtrip tested synthetic stereo PCM WAV sizes 1, 8, and 32 MiB; JSON packages were 1.33× source size, elapsed pack/parse 54/18 ms, 378/106 ms, and 1512/283 ms, with sampled peak RSS increases 22, 124, and 378 MiB. Environment: Windows 10 build 19045 x64, Ryzen 5 5500, 12 logical CPUs, 16,168 MiB RAM, Node 24.12.0. | A single Node environment does not establish practical browser media limits; **no responsible numeric user-facing cap recommendation can be made from this evidence alone**. Current internal 256 MiB/file, 512 MiB/project media, and 800 MiB import-file guards are implementation safeguards, **not approved product limits**, and need conservative product/engineering review. |
| Project persistence | Existing IndexedDB projects remain supported; package imports create a separate project ID and do not replace saved records. Integrated Chromium verified the import reload path. | One browser profile/device; quota/eviction apply. No cloud sync or guaranteed durability. Natural quota, interrupted-write, and native-browser media recovery remain unverified. |
| Availability and commercial scope | Intended target: public production. User instruction: keep the release private until the actual production URL and CTA are supplied. Free beta; no payments, accounts, or cloud features. | URL/CTA and release authorization remain blocking; do not invent a URL or CTA. |
| Privacy/legal | UI says projects and source media stay in the browser, storage can be limited/evicted, there is no cloud sync, and users should keep originals. The stylesheet imports DM Sans from Google Fonts, which makes an external font request. No approved legal/privacy owner or published policy was identified in the reviewed project. | The UI disclosure is useful but is not legal approval or a complete privacy/security review. Assign an owner and review the external request and disclosures. |

## User-approved decisions and remaining decisions

| Topic | Recorded decision | Remaining gate |
|---|---|---|
| Intended release | Public production is the intended target, but keep the release private until the actual URL and CTA are supplied. | Product/launch owner supplies the real production destination/CTA and explicit release authorization. |
| Browser/OS matrix | Latest two stable desktop Chrome, Edge, and Firefox releases on Windows 11; Safari on current and previous macOS major releases. Mobile/tablet are out of scope. | Run and record every approved browser/OS combination; current Chrome/Edge smoke is not sufficient. |
| Portable project files | Downloadable project export/import is **required before launch**. | Implementation is complete; verify disk-saved download independently and complete approved native-browser checks. |
| Commercial scope | Free beta; no payments, accounts, or cloud features. | Keep code and claims within this scope; no payment/account/cloud behavior is approved. |
| Media limits | Representative benchmark and conservative recommendations are authorized; **no numeric limits are approved**. | Determine product limits only after representative browser/device measurements and owner approval. Do not market the current implementation safety guards as supported limits. |
| Legal/privacy | No accountable legal/privacy owner has been assigned. | Assign an owner to review privacy, retention, terms/content rights, data-loss disclosures, and the external Google Fonts request. |

## Launch gates and owners

| Priority | Gate / required action | Accountable owner | Completion evidence |
|---|---|---|---|
| P0 | Supply the production URL/CTA and explicit release authorization; keep release private until done. | Product/launch owner | Working destination/CTA and written authorization. |
| P0 | Execute critical workflows across the approved browser/OS matrix. | Tester | Exact browser/OS/version matrix with import, editing, persistence, and output evidence. |
| P0 | Reproduce the native-Chrome WAV timeout with a known-good independent fixture; compare Chrome and Edge; distinguish fixture/automation/product behavior and fix if confirmed. | Frontend + Tester | Repro steps, browser versions, media metadata, console/event evidence, regression result. |
| P0 | Run critical import, edit, save/reload, and export workflows in every approved native browser/OS combination; include Firefox/Safari if retained as launch targets. | Tester | Completed matrix with exact versions/OS, synthetic fixtures, pass/fail/blocked status, and defects. |
| P0 | Capture an actual downloaded export and independently inspect it for file integrity, decode, dimensions, duration, audio/video tracks, and expected edit parity. | Tester + Frontend | Saved artifact and inspection report; no reliance solely on an in-memory Blob or UI “complete” status. |
| P0 | Verify media-containing project save/reload/recovery and failure behavior; exercise quota/write interruption where safely reproducible. State crash/eviction guarantees conservatively. | Frontend + Tester | Repeatable tests in approved browsers, including media Blobs, and documented limits/failure messages. |
| P0 | Measure representative browser media behavior and review implementation package safety guards; no product numeric limits are approved. | Frontend + Tester + Product owner | Reproducible measurements and an approved conservative product recommendation or explicit no-limit position. |
| P0 | Independently inspect a downloaded project package and confirm the documented export/import behavior. | Tester | Disk-saved package, metadata/media/hash inspection, and import/reload evidence. |
| P0 | Name legal/privacy/content-rights owner and approve required policies, disclosures, retention, and external font/network behavior. | Product/legal/privacy owner | Named approval, published policy links/content as appropriate, and reviewed data-flow disclosure. |
| P0 | Confirm production URL, release stage, access mechanism, and CTA; do not publish unsupported marketing claims. | Product/launch owner | Working destination/CTA and approved, evidence-backed wording. |
| P1 | Complete keyboard, focus, zoom, screen-reader, contrast, and responsive checks across actual editing workflows and agreed viewports. | Tester + Frontend | Accessibility/responsive results with remediated critical defects. |
| P1 | Establish release deployment/rollback, monitoring/support owner, and final clean-install/build procedure. | Release/operations owner | Release checklist, deployed candidate, smoke result, rollback/support contacts. |

## Recommended immediate sequence

1. Keep release private until the real production URL/CTA and release authorization are supplied.
2. Reproduce the native-Chrome audio timeout with an independently validated WAV.
3. Execute the approved native browser/OS matrix; do not treat Electron or first-screen smoke as workflow signoff.
4. Inspect the downloaded project package from disk and characterize representative browser memory/latency before approving any numeric media limits.
5. Assign legal/privacy ownership and review disclosures and external font/network behavior.
6. Re-run the full automated suite, production build, dependency audit, and release smoke on the release candidate.

## Scope and limitations

This report does not certify the product as production-ready or legally compliant. User decisions establish the initial browser support target but do not constitute tested compatibility. It does not claim that all editor features in `PROJECT_SPEC.md` are launch requirements. The product remains a browser-local editor without a backend identified in the reviewed code. Test media/profiles were synthetic and isolated; no commits were made.

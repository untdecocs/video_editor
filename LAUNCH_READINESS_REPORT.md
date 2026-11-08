# Stillwave Social Video Studio — Production Launch Readiness

**Assessment date:** 2026-11-08  
**Scope:** Point 4, “Close product and compatibility gaps”; production-readiness evidence and launch gates only. This is not a plan to implement every professional-editor feature in `PROJECT_SPEC.md`.  
**Decision:** **NOT READY for an official public or commercial production launch.**  
**Release instruction:** Public production is the intended target, but **KEEP RELEASE PRIVATE** until the real production URL and approved CTA are supplied. This is not authorization to expose or announce the product.
**Assessment status:** **PARTIALLY COMPLETED** — user scope decisions are recorded and project package export/import is implemented. Launch gate #2 was attempted only on installed native Chrome/Edge under unsupported Windows 10 conditions; the approved matrix remains blocked, and import, recovery, and export evidence is incomplete.

## Executive assessment

The current React application builds and its automated suite passes (**69/69** in the preceding run). The launch-gate attempt launched the actual installed native Chrome **157.0.8103.38** and Edge **157.0.4341.42** on Windows 10 Pro 22H2 build **19045.6466**; both passed initial-page smoke, which is not workflow coverage. Chrome imported synthetic image/video, exercised title editing and preview playback, and saved a media-containing project once. WAV import was inconsistent across Chrome profiles, Edge timed out on synthetic audio, and Chrome did not complete media-containing recovery after reload or in a new tab. No application-produced downloaded export was obtained.

This is not sufficient launch evidence. The approved target is latest two stable desktop releases of Chrome, Edge, and Firefox on Windows 11, plus Safari on current/previous macOS major releases. Windows 11 and macOS were unavailable; Firefox and Safari executables were unavailable; only one Chrome and one Edge build were installed. The installed browser versions are recorded, but are not claimed to represent both latest stable releases. The successful Chrome workflow was exploratory on Windows 10, not matrix signoff. The media import timeout is now reproducible in Edge and in repeat Chrome attempts with a Python-validated three-second PCM WAV; one Chrome profile did load it, so reliability remains inconsistent. Chrome’s saved IndexedDB project record contained the media and edits, but the application stayed at “Checking local project storage…” after reload and fresh-tab recovery. Export could not be reached reliably and no application output file was inspected.

The actual production URL/CTA is still missing, the legal/privacy owner is unassigned, and no numeric product media limits have been approved. A Node package benchmark shows substantial memory overhead as media grows; it is not sufficient to set universal browser media limits. Commercial scope is approved as a free beta with no payments, accounts, or cloud features. No storage guarantee or broader compatibility claim is inferred.

## Current evidence

| Area | Evidence on 2026-11-08 | Readiness interpretation |
|---|---|---|
| Automated tests | `npm test`: **69 passed, 0 failed** after adding package validation and an 8 MiB regression case for the parser’s former stack-overflow bug. | Pass for repository unit/service tests; not an end-to-end release suite. |
| Build and dependency integrity | `npm run build` passed; `npm ls --depth=0` is clean; `npm audit` reported **0 vulnerabilities**. | Current Node 24.12.0 snapshot; re-run on the release candidate. |
| Native browser smoke and workflows | Actual native Chrome **157.0.8103.38** and Edge **157.0.4341.42** executables launched against `http://127.0.0.1:4173/`; both passed initial-page smoke. Chrome also imported synthetic PNG/WebM, edited a title, played the preview, and saved a media-containing project in one isolated Windows 10 profile. | Exploratory only on Windows 10 Pro 22H2 build **19045.6466** (64-bit), not the approved Windows 11 target. Chrome WAV import was inconsistent; Chrome media recovery failed; Edge WAV/AAC imports timed out; Edge downstream workflows and both application exports were blocked. No Electron was used. |
| Approved browser/OS target | Latest two stable desktop releases of Chrome, Edge, and Firefox on Windows 11; Safari on the current and previous macOS major releases. Mobile/tablet are out of scope. | **BLOCKED / NOT CLOSED.** Windows 11/macOS were unavailable; Firefox/Safari were unavailable; only one Chrome and one Edge version were installed. No claim is made that the installed versions cover the latest two stable releases. |
| Responsive/accessibility spot check | Integrated Electron/Chromium at 320, 375, 390, 768, and 1280 CSS-pixel viewport widths: document/body scroll widths did not exceed the viewport; one `main` and one `h1` were present; project-name and audio file controls had accessible names. | Narrow spot check of the initial page only. Not a WCAG audit, screen-reader/keyboard-flow audit, zoom test, or assessment of the editor timeline at small widths. |
| Native audio import | Synthetic WAV was independently validated as 3-second PCM, mono, 44.1 kHz, 16-bit. One native Chrome profile accepted it; a fresh Chrome profile and Edge timed out reading metadata. A direct Chrome WAV audio-element probe remained at `readyState=0`, `networkState=2`; Edge also timed out on a synthetic AAC/M4A attempt. | **FAIL / reliability issue unresolved.** Do not claim reliable native audio import; isolate browser/app/environment cause and retest. Full per-attempt evidence is in `TEST_RESULTS.md`. |
| Persistence/reload | Native Chrome saved a project with an audio Blob, two visual assets, two clips, and title data; direct inspection confirmed the record remained in the isolated IndexedDB database. After page reload and again in a fresh tab, the app remained at “Checking local project storage…” and showed its default project state rather than applying the saved edit. | **FAIL** for this exercised native-Chrome media-containing recovery case. Native Edge save/reload was blocked by audio import. Broader quota, interrupted-write, crash, and eviction guarantees remain unverified. |
| Output/export | An actual application export download was not obtained. Chrome export was blocked by inconsistent audio import and failed media recovery; Edge export was blocked by audio import. A native-generated WebM fixture download is source test media, not an app export. FFmpeg/FFprobe were unavailable. | **BLOCKED.** On-disk app export decode, metadata, audio tracks/sync, and edit parity remain unverified. |
| Project package | Portable `.stillwave.json` export/import is implemented without a new dependency. It includes all current project metadata and source media as base64 with SHA-256 per-media integrity verification; imports strictly validate and save under a fresh ID before applying. Automated tests pass; integrated Chromium verified roundtrip, metadata/media hashes, reload recovery, malformed-file preservation, and cancellation. | Implementation complete; download-to-disk independent inspection and native target-browser validation remain outstanding. A failed import keeps current edits open. The project document is schema-validated but is not cryptographically signed; media digests detect payload corruption, not provenance/authenticity. |
| Package size/memory benchmark | Local Node roundtrip tested synthetic stereo PCM WAV sizes 1, 8, and 32 MiB; JSON packages were 1.33× source size, elapsed pack/parse 54/18 ms, 378/106 ms, and 1512/283 ms, with sampled peak RSS increases 22, 124, and 378 MiB. Environment: Windows 10 build 19045 x64, Ryzen 5 5500, 12 logical CPUs, 16,168 MiB RAM, Node 24.12.0. | A single Node environment does not establish practical browser media limits; **no responsible numeric user-facing cap recommendation can be made from this evidence alone**. Current internal 256 MiB/file, 512 MiB/project media, and 800 MiB import-file guards are implementation safeguards, **not approved product limits**, and need conservative product/engineering review. |
| Project persistence | Existing IndexedDB projects remain supported; package imports create a separate project ID and do not replace saved records. Integrated Chromium previously verified package import/reload. The new native Chrome attempt confirmed a media-containing record was saved but not recovered by the app. | One browser profile/device; quota/eviction apply. No cloud sync or guaranteed durability. Native media recovery is an open failure, and natural quota/interrupted-write behavior remains unverified. |
| Availability and commercial scope | Intended target: public production. User instruction: keep the release private until the actual production URL and CTA are supplied. Free beta; no payments, accounts, or cloud features. | URL/CTA and release authorization remain blocking; do not invent a URL or CTA. |
| Privacy/legal | UI says projects and source media stay in the browser, storage can be limited/evicted, there is no cloud sync, and users should keep originals. The stylesheet imports DM Sans from Google Fonts, which makes an external font request. No approved legal/privacy owner or published policy was identified in the reviewed project. | The UI disclosure is useful but is not legal approval or a complete privacy/security review. Assign an owner and review the external request and disclosures. |

### Gate #2 matrix disposition — 2026-11-08

| Approved target entry | Status | Evidence / blocker |
|---|---|---|
| Chrome latest stable on Windows 11 | **BLOCKED** | Native Chrome 157.0.8103.38 was exercised only on Windows 10 Pro 22H2 build 19045.6466; partial exploratory workflows do not satisfy the approved OS target. |
| Chrome previous stable on Windows 11 | **BLOCKED** | No second Chrome version or Windows 11 host was available. |
| Edge latest stable on Windows 11 | **BLOCKED** | Native Edge 157.0.4341.42 was exercised only on Windows 10 Pro 22H2 build 19045.6466; audio import timed out. |
| Edge previous stable on Windows 11 | **BLOCKED** | No second Edge version or Windows 11 host was available. |
| Firefox latest and previous stable on Windows 11 | **BLOCKED** | No Firefox executable/build or Windows 11 host was available. |
| Safari current and previous macOS major releases | **BLOCKED** | No macOS host or Safari executable was available. |

**Gate #2 status: BLOCKED / OPEN; it cannot be closed from this environment.** Across 13 tracked smoke/workflow cases: 5 passed, 3 failed, and 5 were blocked. See the exact case table and fixture details in `TEST_RESULTS.md`. The temporary localhost server, browser processes, isolated profiles, generated fixtures, and downloads were stopped/removed after the attempt. No application source was changed.

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

# QA-01 Baseline Characterization and Production Follow-ups

## Production-readiness gate implementation — 2026-11-09

### Audit and changes

- Confirmed a React 18/TypeScript/Vite client-only SPA, no router/backend/hosting workflow, IndexedDB project/media storage, browser-local exports, extension/MIME checks, bounded metadata/decode readers, package safety guards (256 MiB/media, 512 MiB/project media, 800 MiB package), and a structural 24-hour timeline ceiling.
- Centralized production URL, CTA, metadata, release/privacy approvals, media format lists, and pending numeric media limits in `config/`.
- Added a local, read-only readiness dashboard generated outside `dist`; it exposes no approval controls.
- Added protected-allowlist validation and Vite production/private-beta mode build gates. `npm run build` explicitly creates a preview-mode build. `npm run release:public` was run and correctly failed closed for all currently missing gates.
- Removed the Google Fonts external request and switched to system fonts. Source inspection found no app analytics, telemetry, cookies, or project-media upload path; host-provider services still require review.
- Approved file/project/duration limits remain `PENDING_APPROVAL`; existing portable-package and timeline bounds remain technical safeguards, not product promises. File imports now enforce the centralized engineering safety caps before decoding, as well as approved limits when configured, while approvals are absent.

### Validation

| Check | Result |
|---|---|
| `npm test` | **91 passed, 0 failed** |
| `npm run build` | **Passed**; preview mode |
| `npm run release:public` | **Blocked as expected**; URL, CTA, release approver, legal/privacy owner/review, approved media limits, and representative media tests are missing |
| `npm run readiness:dashboard` | **Passed**; generated a local report under `.production-readiness/`, outside `dist` |
| `npm audit` | **0 vulnerabilities** |
| `npm ls --depth=0` | **Passed** |

This verifies the gate mechanics, not any human approval, legal compliance, target-browser media limit, or deployment-provider workflow. The repository has no provider-specific pipeline; any future one must deploy only a successful gated artifact and use protected environment allowlists/reviewers.

## Editor workspace redesign — integrated browser verification — 2026-11-09

### Changes exercised

- At 1440×900, the preview and inspector render side-by-side (preview workspace 795×539px; inspector 530×517px), with a 1311px-wide timeline below both. At 1024px they remain side-by-side; at 768px and below they stack.
- At viewport widths 1440, 1024, 768, 375, and 320 CSS px, document width did not exceed the viewport. The timeline stays inside its horizontally scrollable panel; no page-level horizontal overflow was observed.
- Preview remained centered and retained the selected aspect ratio: landscape 16:9 and TikTok portrait 9:16 (294×522px in the 1440px viewport). Platform preset selection was restored to YouTube after the check.
- Playback controls, playback-position scrubbing, volume, fullscreen entry/exit, format and frame-rate selection, timeline zoom, snap toggle, and track visibility/lock controls were exercised. Test settings were restored.
- Still resizing through the existing duration field changed the clip width from 240px at 5 seconds to 144px at 3 seconds (48px/s), then restored it. A later pointer-drag check moved a clip from 10 seconds to 5.8 seconds.
- The fixture contained a synthetic WAV and PNG, not a video clip. Native-browser video playback and audio/video synchronization remain unverified. Export and project-package follow-up results are recorded below.

### Assessment

The responsive workspace and inspector controls passed integrated-browser spot checks. This is not native browser/OS matrix signoff, full accessibility validation, or production export validation. Clip drag/drop should be confirmed with a native pointer workflow.

## Export and project-package follow-up — 2026-11-09

### Export lifecycle and MP4 artifact

- Export now supports cancellation, preparation/finalization status, bounded video media loading, final `MediaRecorder` data flushing, and validation before the result is returned for download.
- In integrated Electron/Chromium, canceling an export stopped the operation, closed the dialog, and left the project intact.
- A 3-second MP4 export passed the app's output validation and was captured from the generated Blob for byte-level inspection. The 49,581-byte artifact contained MP4 boxes and `soun`/`vide` tracks, reported 1920×1080 dimensions, and approximately 2.943 seconds duration.
- A 0.1-second export generated a small but undecodable file. The new validator rejected it rather than reporting success. Minimum supported soundtrack duration remains a product decision.
- This test does not verify native-browser download UX or independent decoding with an external media tool; FFmpeg/FFprobe are unavailable. Approved native-browser output verification remains open.

### Video-inclusive portable project package

- Exported a 450,382-byte package containing one synthetic WAV, three image entries, and one MP4 entry.
- Independently parsed the package and verified exact byte sizes and SHA-256 hashes for all five embedded media records.
- Imported the package in integrated Chromium, confirmed all four visual clips (three images and the video) appeared on the timeline, reloaded, and confirmed the imported project and video clip were recovered.
- This supplements the earlier audio/image roundtrip. It does not replace native target-browser package testing or provide a storage durability guarantee.

### Automated validation

| Check | Result |
|---|---|
| Complete `npm test` suite | **72 passed, 0 failed** |
| TypeScript and production build | **Passed** |
| `npm audit` | **0 vulnerabilities** |
| `git diff --check` | **Passed** |

Temporary test projects and the loopback QA servers were removed/stopped after verification. This integrated-runtime evidence does not close the native browser/OS matrix or the broader launch gates.

## Launch remediation follow-up — 2026-11-09

### Changes exercised

- Updated audio and video metadata readers to call `load()` after assigning the Blob URL. Saved-project video rehydration now uses the bounded video metadata helper; project storage is not marked ready until the initial recovery attempt completes.
- In integrated Electron/Chromium (**Chrome 150.0.7871.250**), imported a generated 3-second PCM WAV and a 64×48 PNG, saved them to browser storage, reloaded, and confirmed both media items were restored. This does not close the native Chrome/Edge failures recorded below.
- Project toolbar menu: verified eight secondary actions render, Undo/Redo disabled states appear, Escape closes and returns focus to the trigger, and an outside click closes the menu. At 320 CSS px, the menu stayed within viewport bounds.
- A 320px editor check initially found 822px document overflow from preview sizing; the preview/settings and timeline controls were constrained/wrapped. Follow-up measured `documentWidth=320`, `bodyWidth=320`.
- In the integrated runtime, `MediaRecorder.isTypeSupported()` accepted WebM, but `video.canPlayType()` returned empty for both VP9 and VP8. Duration-adaptive recording cadence produced a 20,681-byte WebM Blob for a 0.5-second fixture and a 68,367-byte WebM Blob for a 3-second fixture; the latter had EBML signature `1a45dfa3`. The runtime failed to decode that WebM output (`DEMUXER_ERROR_COULD_NOT_OPEN`); this was one failed format/runtime experiment, not evidence that the later MP4 artifact passed native-browser validation.
- A 0.1-second fixture still produced a zero-byte recording after reducing the data cadence. Renderer now rejects zero-byte output; the UI returned `Export failed: The browser produced an empty video file...` rather than claiming completion. The supported minimum duration remains a product decision; do not imply this edge case is fixed.

### Automated validation

| Check | Result |
|---|---|
| Targeted metadata and persistence tests | **13 passed, 0 failed** |
| Complete suite | **69 passed, 0 failed** at this earlier checkpoint; current result is 72/72 above |
| TypeScript and production build | **Passed** on the final code changes |
| `git diff --check` | **Passed** on the final code changes |

At this checkpoint, the approved native browser/OS matrix, app-generated output inspection, project-package disk inspection, and final dependency audit remained open. The follow-up above closes package disk/hash inspection for the exercised fixture but does not close native target-browser signoff or the wider release gates.

## Launch gate #2 — native browser/OS workflow attempt — 2026-11-08

**Disposition:** **BLOCKED / NOT CLOSED.** This attempt did not validate the approved Windows 11/macOS matrix. It used the actual installed desktop Chrome and Edge executables (not Electron and not headless) on the available Windows 10 host. Successful exploratory cases on that unsupported OS are not compatibility signoff.

### Environment and fixtures

| Item | Observed |
|---|---|
| OS | Windows 10 Pro 22H2, version 10.0.19045, build **19045.6466**, 64-bit. Windows 11 and macOS hosts were not available. |
| Native Chrome | **157.0.8103.38**, `C:\Program Files\Google\Chrome\Application\chrome.exe`. |
| Native Edge | **157.0.4341.42**, `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. |
| Firefox / Safari | No Firefox executable was found via PATH, common Program Files locations, or StartMenuInternet registry entries. Safari/macOS was unavailable on this Windows host. |
| Installed release coverage | Only one Chrome and one Edge build were available; a second stable build for either browser was not installed. Installed versions are recorded exactly, not asserted to be the latest two stable releases. |
| Application | Temporary Vite dev server at `http://127.0.0.1:4173/`, bound to loopback; server stopped after testing. Each browser used a unique temporary profile and download directory. |
| Synthetic audio | `synthetic-audio.wav`, 264,644 bytes; Python `wave` independently read PCM, mono, 16-bit, 44,100 Hz, 132,300 frames (3 seconds), uncompressed. A browser-generated AAC/M4A was also tried in Edge, without successful app metadata import. |
| Synthetic visuals | 160×90 PNG, 302 bytes. A native-browser MediaRecorder-generated WebM video fixture (about 1.6 seconds; 3,186 bytes in Chrome and 3,188 bytes in Edge) was also used. The source WebM was imported in Chrome; it is not an application export. |
| Media inspection tools | FFmpeg/FFprobe were not available. No application-produced export file was downloaded. |

### Executed cases

| Test ID | Browser / workflow | Actual result | Status |
|---|---|---|---|
| NBR-CH-SMOKE-001 | Chrome initial-page smoke | Native Chrome loaded the local application title and React editor/project controls. This is page-load smoke only. | **PASS** |
| NBR-ED-SMOKE-001 | Edge initial-page smoke | Native Edge loaded the local application title and React editor/project controls. This is page-load smoke only. | **PASS** |
| NBR-CH-AUDIO-001 | Chrome WAV import | One isolated Chrome profile reported `Loaded synthetic-audio.wav` and enabled continuation. A repeat from a fresh profile timed out; an independent audio-element probe on the same validated WAV remained at `readyState=0`, `networkState=2`. Import was not reproducible. | **FAIL** |
| NBR-CH-VISUAL-001 | Chrome image/video import | Imported the synthetic PNG and WebM; the editor listed both media items and added two visual clips (image 5.0 s; video about 1.6 s). | **PASS** |
| NBR-CH-EDIT-001 | Chrome basic editing and preview | Added/edited a title, sought the preview, and played/paused. The play control entered the playing state and the soundtrack time advanced to about 1.17 s. This does not verify title rendering in an export. | **PASS** |
| NBR-CH-SAVE-001 | Chrome project save | UI reported `Saved “Gate 2 Chrome QA” in this browser.` An isolated IndexedDB inspection found the named project, soundtrack Blob, two visual media Blobs, two clips, and title data. | **PASS** |
| NBR-CH-REC-001 | Chrome reload/recovery | After reload and again in a newly opened native Chrome tab, the app remained at `Checking local project storage…`, showed the default project name/audio step, and did not apply the saved project. The saved project remained in the isolated IndexedDB record. | **FAIL** |
| NBR-CH-EXP-001 | Chrome application export | Not reached reliably: audio import was inconsistent and media-containing recovery did not complete. The downloaded synthetic WebM fixture is not an application export. | **BLOCKED** |
| NBR-ED-AUDIO-001 | Edge audio import | The validated WAV import timed out with `Timed out while reading audio metadata`; an additional synthetic AAC/M4A attempt also timed out in the app. No soundtrack was accepted. | **FAIL** |
| NBR-ED-VISUAL-001 | Edge image/video import | Not reached because the soundtrack prerequisite failed. | **BLOCKED** |
| NBR-ED-EDIT-001 | Edge editing/preview | Not reached because the soundtrack prerequisite failed. | **BLOCKED** |
| NBR-ED-PERSIST-001 | Edge save/reload/recovery | Not reached because no project could be created from the failed soundtrack import. | **BLOCKED** |
| NBR-ED-EXP-001 | Edge application export | Not reached because the soundtrack prerequisite failed. | **BLOCKED** |

### Approved matrix availability

| Approved target | Result | Environment evidence |
|---|---|---|
| Chrome, latest stable release, Windows 11 | **BLOCKED** | Chrome 157.0.8103.38 was available only on Windows 10 Pro 22H2 build 19045.6466; Windows 11 was unavailable and release recency was not independently confirmed. Exploratory workflows above are not target signoff. |
| Chrome, previous stable release, Windows 11 | **BLOCKED** | No second Chrome build or Windows 11 host available. |
| Edge, latest stable release, Windows 11 | **BLOCKED** | Edge 157.0.4341.42 was available only on Windows 10 Pro 22H2 build 19045.6466; Windows 11 was unavailable and release recency was not independently confirmed. Exploratory workflows above are not target signoff. |
| Edge, previous stable release, Windows 11 | **BLOCKED** | No second Edge build or Windows 11 host available. |
| Firefox, latest and previous stable releases, Windows 11 | **BLOCKED** | No Firefox executable/build available; Windows 11 host unavailable. |
| Safari, current and previous macOS major releases | **BLOCKED** | No macOS host or Safari executable available. |

### Execution totals and limits

| Metric | Result |
|---|---:|
| Workflow cases | 13 |
| Passed | 5 |
| Failed | 3 |
| Blocked | 5 |
| Not tested | 0 within the 13 listed workflow cases |

The two initial-page smoke passes are explicitly separate from editing, persistence, and export coverage. Mobile/tablet were out of scope. The native browser sessions, isolated profiles, synthetic fixtures, downloads, and temporary localhost server were closed/stopped and removed after the attempt. No application source code changed; automated tests/build were not rerun because this was a documentation-only QA update.

## Portable project package and user launch decisions — 2026-11-08

### Decisions recorded

- Intended target is public production, but keep the release private until the actual production URL and approved CTA are supplied.
- Browser target: latest two stable desktop releases of Chrome, Edge, and Firefox on Windows 11; Safari on current and previous macOS major releases. Mobile/tablet are out of scope.
- Portable downloadable project export/import is required before launch.
- Commercial scope is free beta; no payments, accounts, or cloud features.
- Representative media benchmarking and conservative recommendations are authorized, but no numeric media limits are approved.
- Legal/privacy owner remains unassigned.

### Automated verification

| Check | Result |
|---|---|
| `npm test` | **69 passed, 0 failed** after adding package validation tests and the large-payload parser regression. |
| `npm run build` | **Passed** (TypeScript and Vite production build). |
| `npm ls --depth=0` | **Passed**, no invalid/missing direct dependencies. |
| `npm audit` | **0 vulnerabilities** reported. |
| `git diff --check` | **Passed**. |

### Portable package browser validation

Tester exercised the export/import flow in integrated Chromium with synthetic 0.5-second WAV audio (22,094 bytes) and 64×48 PNG image (273 bytes), plus a clip, title, marker, and custom output settings. Export generated a 31,657-byte JSON Blob. The browser tooling did not provide a download event or disk-read access, so the exact Blob was inspected instead of an on-disk file.

The two package media records had independently recomputed SHA-256 digests matching the package. Audio bytes began with RIFF/WAVE and image bytes with PNG signatures. Project schema v5 metadata, edits, markers, and WebM/custom output settings were present. Import created a new project ID and preserved the original saved project; imported metadata and media were stored in IndexedDB and the imported project recovered after reload with its title and visual asset. Malformed JSON and canceled import both left active edits and existing saved-project records unchanged.

**Result:** Four browser checks passed; one disk-download/read-back check was blocked by the harness. This was integrated Chromium, not native Chrome/Edge/Firefox/Safari validation. No product defect was found in the exercised flows.

### Parser scaling defect and fix

A Node benchmark initially reproduced a `RangeError: Maximum call stack size exceeded` in whole-string base64 regex validation on an 8 MiB media payload (1 MiB parsed successfully). The Frontend agent replaced the large regex/`atob` path with bounded manual base64 validation/decoding and added 8 MiB roundtrip, malformed-payload, and non-canonical-padding tests. Independent follow-up `npm test` passed **69/69**, including the 8 MiB case, and the production build passed.

### Representative package benchmark

This measured package JSON/base64 construction and parsing, not browser media import/decode, video export, or universal support limits.

| Environment / synthetic media | JSON package size (expansion) | Build | Parse | Sampled peak RSS increase |
|---|---:|---:|---:|---:|
| 1 MiB / 5.9 sec silent stereo PCM WAV | 1.33 MiB (1.33×) | 53.6 ms | 17.5 ms | 21.5 MiB |
| 8 MiB / 47.6 sec silent stereo PCM WAV | 10.67 MiB (1.33×) | 377.7 ms | 106.4 ms | 123.9 MiB |
| 32 MiB / 190.2 sec silent stereo PCM WAV | 42.67 MiB (1.33×) | 1,512 ms | 283.4 ms | 377.6 MiB |

Measured host: Windows 10 build 19045 x64; AMD Ryzen 5 5500, 12 logical CPUs, 16,168 MiB RAM; Node v24.12.0. Cases ran in separate Node processes; RSS was sampled at 1 ms intervals, so transient peaks may be missed. This one-machine Node benchmark is **insufficient to recommend numeric user-facing media limits** or claim browser support. Current implementation guards of 256 MiB per media, 512 MiB total source media, and 800 MiB package file are implementation safety bounds only; they are not user-approved product limits and require browser-memory review.

**Integrity scope:** SHA-256 covers each source-media payload. The project document receives strict version/schema validation but is not cryptographically signed or authenticated; hashes do not establish package provenance.

**Open validation:** Exercise approved target browsers/OSes; independently decode the captured app-generated MP4 with an external media tool and verify native download UX; characterize browser memory for representative audio/image/video projects; reproduce the native Chrome synthetic-WAV metadata timeout; assign a legal/privacy owner; supply production URL/CTA and explicit release authorization. The video-inclusive project package passed disk hash/size inspection and integrated import/reload for this fixture. The current benchmark is insufficient to recommend numeric product media limits. Official status remains **NOT READY**; keep release private.

## Initial production readiness checkpoint — 2026-11-08 (before package implementation)

**Scope:** Point 4, “Close product and compatibility gaps.” No product source code was changed.

### Environment and current checks

| Item | Result |
|---|---|
| Worktree at assessment start | Clean on `main`, commit `9600cff`. |
| Runtime | Node 24.12.0; npm 11.6.2. |
| Automated tests | `npm test`: **59 passed, 0 failed**. |
| Production build | `npm run build`: TypeScript build and Vite 8.3.5 production build passed. |
| Direct dependencies | `npm ls --depth=0`: no invalid/missing direct dependencies. |
| Dependency audit | `npm audit`: **0 vulnerabilities** reported. |
| Native Chrome | 157.0.8103.38; isolated headless production-preview smoke rendered the expected title and React editor screen. |
| Native Edge | 157.0.4341.42; isolated headless production-preview smoke rendered the expected title and React editor screen. |
| Other targets | Firefox and Safari executables were not found. The exact Windows OS build was not recorded. |

Chrome/Edge smoke only proves initial-page loading in those observed builds; it does not establish media, persistence, export, or release compatibility. Integrated Electron/Chromium is also not a substitute for native browsers.

### Responsive/accessibility spot check

In the integrated VS Code Electron/Chromium browser, the production preview was checked at viewport widths **320, 375, 390, 768, and 1280 CSS pixels**. Document/body scroll width did not exceed the viewport at any tested width. The initial page exposed one `main` landmark and one `h1`; the project-name and audio-file controls had accessible names. This is a limited initial-screen spot check, **not** a WCAG conformance audit or a full editor/timeline, keyboard, screen-reader, zoom, contrast, or native-browser check.

### Native Chrome synthetic-audio follow-up

A Tester run used an isolated Chrome 157 profile, a synthetic 3-second PCM WAV, and the production preview. Audio metadata did not arrive before the application timeout; the observer reported `readyState=0`, and the app did not accept the soundtrack. The run did not proceed to media-containing project recovery or export.

The same isolated run saved an empty project named `QA-temp-recovery`, reloaded the page, and observed the project name and one IndexedDB record still present. The record contained no audio or visual assets, and the page did not show an explicit recovery status. This is evidence for empty-project metadata persistence only, not for recovery of edits/media or crash/eviction resilience.

**Classification:** one native-Chrome media-import observation requiring reproduction. It is not yet a confirmed product defect; fixture, browser-automation, and application causes were not isolated. No downloaded export file was produced or independently inspected. FFmpeg/FFprobe were unavailable.

### Launch-readiness interpretation

At this checkpoint, automated/build/dependency checks passed and Chrome/Edge rendered the initial production screen. The supported browser/OS matrix and portable project-file requirement had been recorded, but target-matrix validation and downloaded-file testing remained open; product media limits, actual launch URL/CTA, and legal/privacy ownership were unresolved. Native Firefox/Safari were unavailable in this environment. See the latest report above for current evidence and the complete launch gates. **Official production launch status: NOT READY.**

---

**Run date:** 2026-11-02
**Scope:** Existing audio/image/video import, clip order and timing, split, transforms, preview/playback, and current export success/error handling. No product code was changed.

## Environment and evidence

| Item | Observed |
|---|---|
| Application | `audio-video-creator` 1.0.0, Vite development server at `http://127.0.0.1:5173/` |
| Host | Windows; browser user-agent reported `Windows NT 10.0; Win64; x64` (exact OS build not exposed) |
| Browser actually used | Integrated VS Code browser: Electron 43.8.3, Chromium/Chrome 150.0.7871.250 |
| Runtime | Node v24.12.0 |
| Other target browsers | Native Chrome, Edge, Firefox, and Safari were not run; no native browser executables were found on PATH |
| Media inspection | Chromium media element and MP4 box signatures; FFmpeg/FFprobe were unavailable |
| Automation | Integrated browser page/Playwright controls; no repository-managed browser test harness |

These results apply only to this browser session and are not evidence of compatibility with the native target browsers.

## Safe fixtures

All fixtures were synthetic and kept outside the repository in `%TEMP%\qa01-fixtures`; none were committed.

- `qa01-tone-3s.wav`: 3-second, mono, 22,050 Hz, low-amplitude 440 Hz sine wave generated with Python's standard `wave` and `math` modules.
- `qa01-redblue-160x90.png`: 160×90 RGB image split into red and blue halves.
- `qa01-green-160x90.png`: 160×90 solid green RGB image.
- `qa01-export-derived.mp4`: generated by exporting the synthetic WAV plus PNG in the application, then importing the resulting in-memory MP4 Blob into a fresh editor session. This avoids use of copyrighted or personal media; it is not an independent encoder fixture.

For a repeat run, generate equivalent short synthetic WAV/PNG files locally, import them with the file chooser, and create the video fixture by exporting then re-importing the result. If an independently encoded video is required, use a short locally generated or redistributable test clip and record its codec and source.

## Executed cases

All expected results below are limited to the named browser session and fixture.

| Test ID | Preconditions / steps | Expected result | Observed result | Status |
|---|---|---|---|---|
| QA01-IMP-001 | Select `qa01-tone-3s.wav` on the soundtrack step. | File loads and duration is detected. | File name displayed; UI detected 0:03 and `audio/wav`; Continue became enabled. | **PASS** |
| QA01-IMP-002 | Select both synthetic PNGs together in the visuals file chooser. | Both valid images become sequence clips with names and durations. | Two clips added in selection order; each displayed as a 5.0 sec still. | **PASS** |
| QA01-TL-001 | With the two images loaded, move the second clip up, then move it down. | Order follows each operation and returns to the original order. | Names changed to green/red-blue, then returned to red-blue/green. | **PASS** |
| QA01-TL-002 | Select the first still; reduce the duration slider from 5 to 2 seconds using keyboard input. | Clip duration and timeline label update to 2 sec. | Slider and timeline both showed 2 sec. | **PASS** |
| QA01-TL-003 | Import `qa01-export-derived.mp4`; set In=0.2 sec and Out=2.5 sec; select “Split at midpoint”. | Range is 2.3 sec and becomes two adjacent clips whose durations sum to the original. | UI showed 1.1 sec + 1.2 sec (rounded display); second segment began at 1.3499999999999999 sec and ended at 2.5 sec. Total remained 2.3 sec. | **PASS** |
| QA01-TR-001 | On a still clip, select Fit entire image, Rotation 90°, and Flip horizontal. | Controls update and preview reflects the selected transformation. | Preview image style reflected `object-fit: contain`, `scale(-1, 1)`, and `rotate(90deg)`. Export parity was not checked. | **PASS** |
| QA01-PV-001 | With the 3 sec audio and two image clips, play for about 2.2 sec, then pause. | Playback advances; preview transitions to the second clip at its sequence boundary; pause stops playback. | Play state was active at observation, time reached about 2 sec, preview image matched the second clip, and Pause returned to Play. | **PASS** |
| QA01-PV-002 | Import the export-derived MP4; wait for media metadata and inspect the preview video element. | Video metadata loads and preview can use the clip. | Video element reached `readyState=4`, duration 2.977433 sec, 1920×1080; preview/video source was present. | **PASS** |
| QA01-PV-003 | On the video clip, set In=0.2 sec and observe preview source `currentTime`; repeat with In=0.5 sec. | Preview seeks to the selected source in-point (within expected media seek tolerance). | At In=0.2 sec, preview stayed at source time 0.0 sec; at In=0.5 sec, it sought to 0.5 sec. See `BUG-QA01-001`. | **FAIL** |
| QA01-EX-001 | Export the 3 sec synthetic WAV + still as MP4 at default YouTube 1920×1080, 30 fps. Intercept the generated Blob in the browser and inspect it with a media element and MP4 box signatures. | Export completes and output is non-empty, decodable, with expected dimensions/duration and audio/video tracks. | UI said “Export complete”; Blob was 67,542 bytes, `video/mp4`, and Chromium decoded it as 1920×1080 with duration 2.977433 sec. MP4 contained `ftyp`, `mdat`, `vide`, and `soun` signatures. | **PASS** (Blob/render only; see next case) |
| QA01-EX-002 | Wait for the browser download event and independently inspect a downloaded file. | A saved output file is available for file-size, decode, and metadata inspection. | The integrated browser did not emit a Playwright download event within 30 sec, despite the app completion status; no saved file or FFprobe inspection was available. | **BLOCKED** |
| QA01-EX-003 | With valid media loaded, temporarily make `HTMLCanvasElement.prototype.captureStream` unavailable in the test page and click Create video; restore it afterwards. | Render failure is reported, progress dialog closes, and retry remains possible. | UI showed “Export failed: Canvas video capture is not supported in this browser.” Dialog closed and Create video was re-enabled. This was an injected failure condition, not a naturally occurring browser failure. | **PASS** |
| QA01-IMP-003 | Exercise drag/drop, empty/corrupt/unsupported media, duplicate and large files, cancellation/removal, and error cleanup. | Supported behavior and clear errors are established for each case. | Not executed in this run. | **NOT TESTED** |
| QA01-EX-004 | Test WebM, alternate resolutions/frame rates, export of transformed clips, and output parity. | Each supported setting produces a playable output that matches the edit. | Not executed in this run. | **NOT TESTED** |
| QA01-XBR-001 | Repeat critical import/edit/preview/export cases on native Chrome, Edge, Firefox, and Safari. | Browser-specific behavior and limitations are measured. | Only integrated Electron/Chromium was available and used. | **NOT TESTED** |

## Execution totals

| Metric | Result |
|---|---:|
| Manual/browser cases | 15 |
| Passed | 10 |
| Failed | 1 |
| Blocked | 1 |
| Not tested | 3 |

## Automated and build validation

| Command | Result |
|---|---|
| `npm test` | **Passed:** 12 tests, 0 failures (timeline helper and JSON project-model tests). |
| `npm run build` | **Passed:** TypeScript build and Vite 8.3.5 production build. |
| `git diff --check` | Run after QA documentation updates; see final handoff result. |

## Defects and limitations

- **Verified in retest:** `BUG-QA01-001` preview in-point seek fix; see the dated retest below and `BUG_REPORTS.md`.
- The MP4 render Blob was generated and decoded in Chromium, but an actual persisted browser download was not obtained. This is not a verified end-to-end download.
- No real native browser matrix, FFmpeg/FFprobe validation, WebM export, malformed-media handling, drag/drop, large-file behavior, or transformed export parity was tested.
- The export-derived video fixture depends on the application's own MP4 renderer, so it does not independently validate arbitrary imported-video codec support.

## QA assessment

**QA-01 baseline: PARTIAL / BLOCKED for full acceptance.** The preview trim defect has since passed the targeted retest below. The download artifact, target-browser matrix, and several import/export paths remain unverified. This is not a release-readiness assessment.

## BUG-QA01-001 Frontend fix retest

**Run date:** 2026-11-02

**Scope:** Independent browser retest of small video in-points, paused preview seeking, metadata, clip/asset changes, and playback. No application source was modified.

**Environment:** `http://127.0.0.1:5173/`, app package 1.0.0, local Vite development server; Windows host; integrated VS Code browser, Electron 43.8.3 / Chromium 150.0.7871.250 (user-agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.144.0 Chrome/150.0.7871.250 Electron/43.8.3 Safari/537.36`); Node v24.12.0.

**Fixture:** Imported a locally generated, editor-exported MP4 made from the synthetic 3-second WAV and green PNG already described above. The browser decoded it as `video/mp4;codecs=avc1.42e01e,mp4a.40.2`, 83,639 bytes, 3.0097 seconds, 1920×1080, `readyState=4`. The Blob was re-imported into the editor as a `File`; it was not independently encoded or saved as a standalone file.

| Test ID | Check | Actual result | Status |
|---|---|---|---|
| QA01-PVR-001 | Import video and wait for metadata | Loaded and decoded; duration 3.0097 sec, 1920×1080, `readyState=4`. | **PASS** |
| QA01-PVR-002 | Set In=0 while paused | Preview `currentTime=0`, paused. | **PASS** |
| QA01-PVR-003 | Set In=0.1 while paused | Preview `currentTime=0.1`, paused. | **PASS** |
| QA01-PVR-004 | Set In=0.2 while paused | Preview `currentTime=0.2`, paused. | **PASS** |
| QA01-PVR-005 | Set In=0.4 while paused | Preview `currentTime=0.4`, paused. | **PASS** |
| QA01-PVR-006 | Set In=0.5 while paused | Preview `currentTime=0.5`, paused. | **PASS** |
| QA01-PVR-007 | Split the trimmed clip, select second segment, seek timeline to 1.4 sec | Second segment selected; its source In was 1.75485 sec; paused preview reached source `currentTime=1.9`. `readyState=1` at the observation. | **PASS** |
| QA01-PVR-008 | Add/select a second video asset and seek into it | Second asset selected; at timeline 2.6 sec the preview loaded (`readyState=4`) and sought to source `currentTime=0.0903`, paused. | **PASS** |
| QA01-PVR-009 | Start/pause playback | From In=0.5, preview advanced to 1.228 sec while playing and was paused after Pause (1.197 sec at observation). On the second asset, it advanced from 0.0903 to 0.3018 sec and paused (0.2831 sec at observation). | **PASS** |

During an initial playback check at timeline 2.7 sec, the 3-second soundtrack ended before the scripted Pause action; the check was repeated at 2.6 sec and play/pause both behaved as expected. This boundary attempt is not counted as a product failure.

### Retest execution totals

| Metric | Result |
|---|---:|
| Total retest cases | 9 |
| Passed | 9 |
| Failed | 0 |
| Blocked | 0 |
| Not tested | 0 |

**Automated regression on this run:** `npm test` passed 14/14 tests, including the five in-point helper assertions; `npm run build` passed TypeScript and Vite production build. These checks complement but do not replace the browser retest.

**Retest outcome:** The original paused preview `currentTime=0` behavior at In=0.2 was not reproduced. All five requested in-points caused the preview to seek to the configured source time. Marked `BUG-QA01-001` **VERIFIED** for preview in-point seeking.

**Remaining gaps:** Did not verify source-range parity in the rendered export, a moving independent video fixture, native Chrome/Edge/Firefox/Safari, persisted downloads, or FFmpeg/FFprobe inspection. Full QA readiness remains limited by the outstanding baseline export/download and browser-matrix coverage; this targeted retest is not a release-readiness assessment.

## DATA-02 focused browser verification

**Run date:** 2026-11-02  
**Scope:** Browser-local project creation, audio/image persistence, autosave, explicit save, reload recovery, explicit reopen, and user feedback on a simulated IndexedDB failure. No product code was changed.

**Environment:** `http://127.0.0.1:5173/`; Windows host; integrated VS Code browser, Electron 43.8.3 / Chromium 150.0.7871.250 (user-agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.144.0 Chrome/150.0.7871.250 Electron/43.8.3 Safari/537.36`); Node v24.12.0. Browser actions and reload were performed using the integrated browser controls/Playwright page. Native Chrome, Edge, Firefox, and Safari were not available for this run; there is no repository-managed end-to-end browser suite.

**Synthetic fixtures:** Generated outside the repository in `%TEMP%\data02-qa-media`: a 1-second mono 22,050 Hz WAV (44,144 bytes) and a 4×4 red PNG (73 bytes). These were uploaded to the editor; no personal or third-party media was used.

| Test ID | Steps | Observed result | Status |
|---|---|---|---|
| DATA02-BRW-001 | Open the app and wait for startup storage initialization. | UI reported “Local project storage is ready. Edits will autosave in this browser.” Saved-project list was empty. | **PASS** |
| DATA02-BRW-002 | Import the WAV; advance to visuals; name the project “DATA-02 QA probe”; import the PNG; wait more than the autosave debounce. | Audio duration/type and image clip appeared. Saved-project list showed the named project and status reported it saved locally. | **PASS** |
| DATA02-BRW-003 | In the editor, set the clip transition to Fade and frame rate to 24 FPS; wait for autosave; click Save. | Values remained selected and the project status reported “Saved ‘DATA-02 QA probe’ in this browser.” | **PASS** |
| DATA02-BRW-004 | Reload the integrated browser page and wait for startup recovery. | App restored the named project with the WAV, PNG clip, Fade transition, and 24 FPS setting; status settled on “Saved ‘DATA-02 QA probe’ in this browser.” after startup autosave. | **PASS** |
| DATA02-BRW-005 | Use Save as to create a second named copy; select the original “DATA-02 QA probe” record and click Open. | Original project name, audio, image clip, transition, and frame rate were loaded; the project returned to a saved status. | **PASS** |
| DATA02-BRW-006 | In the already-open project, replace `IDBDatabase.prototype.transaction` in the page with a test stub that throws `SecurityError`; click Save. | UI displayed “Could not access browser project storage (QA simulated denial). Check browser storage permissions and retry. Your current edits are still open.” Project name, audio, and clip stayed visible. The failure was injected, not a naturally occurring browser/storage denial. | **PASS** |
| DATA02-BRW-007 | Reload after the injected failure; confirm the prior saved record recovers. Delete the generated copy and original via the app's confirmation dialogs. | Previously persisted project recovered. After deletion, list showed “No saved projects yet”; editor returned to a blank project. The local WAV/PNG source files still existed after deleting their saved copies. | **PASS** |

### DATA-02 execution totals

| Metric | Result |
|---|---:|
| Focused browser cases | 7 |
| Passed | 7 |
| Failed | 0 |
| Blocked | 0 |
| Not tested | 0 |

**Automated checks on this run:** `npm test` passed 21/21 Node tests, including injected-backend coverage for persistence/restore, malformed or missing media, project deletion, quota errors, and unavailable IndexedDB. `npm run build` passed TypeScript and Vite production build.

**Outstanding gaps:** Native target browsers and cross-browser reload/storage behavior were not tested. Browser failure feedback was checked through an injected `SecurityError`, not an actual browser permission denial, quota exhaustion, eviction, or blocked upgrade. Crash/interrupted-write recovery, large-media quota limits, missing/corrupt media via the UI, and persistent automated E2E coverage remain unverified. DATA-02 remains **IN_REVIEW**.

## HIST-01 integrated history verification

**Run date:** 2026-11-02
**Scope:** Independently verified the integrated Undo/Redo UI, keyboard shortcuts, edit restoration, media URL recovery, and history boundaries across Open and New. No product code was changed.

### Environment and test data

| Item | Observed |
|---|---|
| Application | Vite development server at `http://127.0.0.1:5173/`; `audio-video-creator` 1.0.0 |
| Host/runtime | Windows; Node v24.12.0 |
| Browser | Integrated VS Code browser, Electron 43.8.3 / Chromium 150.0.7871.250; user-agent `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.144.0 Chrome/150.0.7871.250 Electron/43.8.3 Safari/537.36` |
| Test method | Integrated browser accessibility snapshots and Playwright page controls; not a repository-managed E2E suite |
| Fixtures | Synthetic 3-second mono WAV and two PNG stills generated under `%TEMP%\hist01-fixtures`; a 3.0759-second 1920×1080 MP4 Blob was produced by the editor's renderer and re-imported as a video-editing fixture. No personal or third-party media was used. |

These results apply only to the integrated Electron/Chromium runtime. Native browser testing was outside this assigned run and was not performed.

### Executed cases

| Test ID | Steps | Expected / observed result | Status |
|---|---|---|---|
| HIST01-UI-001 | Open the blank editor; inspect Undo/Redo by accessible role; import the WAV; undo to the empty state. | Both controls initially disabled. After import, Undo enabled and Redo disabled. Undo removed the audio and returned Undo to disabled / Redo to enabled. | **PASS** |
| HIST01-KB-001 | Use Ctrl+Z and Ctrl+Shift+Z for audio; use Ctrl+Y to redo edits; observe control states. | Undo/redo restored the audio/edit state, including boundary button states. Ctrl+Y successfully redid clip/output edits. | **PASS** |
| HIST01-KB-002 | Focus Project name, change its text, and press Ctrl+Z while editor history is available. | The app-level media/edit state and Undo/Redo availability did not change; shortcut handling was inactive in the text field. | **PASS** |
| HIST01-TL-001 | Import two stills and the generated MP4; reorder stills/video; undo and redo the moves. | Displayed sequence order followed each move; keyboard undo/redo restored the prior and reordered sequences. | **PASS** |
| HIST01-TL-002 | Set video In to 0.2 sec and Out to 2.5 sec; undo and redo the Out edit. | Timeline showed 2.3 sec; undo restored Out to 3.0759 sec and redo restored 2.5 sec. | **PASS** |
| HIST01-TL-003 | Split the trimmed 2.3-sec clip at its midpoint; undo and redo. | Two adjacent segments displayed as 1.1 sec + 1.2 sec (rounded); source split point was 1.3499999999999999 sec. Undo restored one 2.3-sec clip; redo restored both segments. | **PASS** |
| HIST01-TR-001 | Change selected still Fit to contain, Rotation to 90°, and Flip horizontal; undo three edits and redo three. | Controls returned to cover / 0° / unchecked on undo and to contain / 90° / checked on redo. | **PASS** |
| HIST01-OUT-001 | Change output preset from YouTube to Instagram Reels; undo and redo. | Canvas changed from 1920×1080 to 1080×1920; undo restored YouTube and redo restored Instagram. | **PASS** |
| HIST01-DEL-001 | Delete the only video clip referencing its asset; use Redo and Undo buttons; inspect restored media and play. | Redo removed the video and disabled Redo; Undo restored it under a new `blob:` URL. Restored video reached `readyState=4`, duration 3.0759 sec, 1920×1080. During preview, video currentTime advanced 0.2→1.13 sec and the 3-sec WAV advanced 0→0.88 sec; both were playing and unpaused. | **PASS** |
| HIST01-PJ-001 | Rename the project to “HIST-01 QA temporary”, click Save with history available, then open the saved project. | Open restored the audio, clips, trim, and video media; video/audio metadata loaded (`readyState=4`). Undo and Redo were both disabled after opening, confirming the history boundary. | **PASS** |
| HIST01-PJ-002 | After Open, change frame rate to 24 FPS to create history, then start New. | Undo became enabled after the edit; New returned to the blank soundtrack step and disabled both Undo and Redo. | **PASS** |
| HIST01-REG-001 | Render a short fixture with Create video and re-import the in-memory Blob for split/playback checks. | Export reported complete and created an 80,303-byte `video/mp4;codecs=avc1.42e01e,mp4a.40.2` Blob, which loaded and played as the editing fixture. This validates the fixture path only, not a saved download. | **PASS** |
| HIST01-MAC-001 | Verify Command+Z / Command+Shift+Z / Command+Y on macOS. | Not available on this Windows host; native macOS behavior was not tested. | **NOT TESTED** |
| HIST01-XBR-001 | Repeat critical history cases in native Chrome, Edge, Firefox, and Safari. | Native browser matrix was explicitly out of scope and unavailable in this run. | **NOT TESTED** |
| HIST01-EXP-001 | Independently inspect a persisted output download and validate it with FFmpeg/FFprobe, including rendered source-range parity. | Not performed. The browser Blob was used in-memory; FFmpeg/FFprobe were unavailable. | **NOT TESTED** |
| HIST01-LIMIT-001 | Create and undo/redo 50 edits through the UI. | The app configures a 50-snapshot cap and service tests cover eviction, but no 50-action UI stress test was run. | **NOT TESTED** |

### HIST-01 execution totals

| Metric | Result |
|---|---:|
| Browser cases | 16 |
| Passed | 12 |
| Failed | 0 |
| Blocked | 0 |
| Not tested | 4 |

**Automated and build regression:** `npm test` passed **28/28** Node tests, including history boundary/order/branch/limit/isolation tests and timeline/project/media-URL suites. `npm run build` passed TypeScript and the Vite 8.3.5 production build. The integrated browser reached a clean new-project state after the run; the temporary saved project was deleted through the UI. `git diff --check` was run after QA documentation updates.

**Notes / remaining limits:** The first test-generated WebM attempt was not a decodable fixture and was rejected; it was discarded and is not counted as an application failure. A valid MP4 fixture was instead generated through the app and re-imported. This does not independently verify arbitrary imported codecs or exported source-range accuracy. A test wait for the transient “Opened …” status text timed out; the project state and history reset were independently verified, and the status later showed “Saved …” after autosave. Meta/Command shortcuts, native target browsers, persisted download inspection, and UI-level history-cap stress remain unverified. No regression was observed in the exercised editing/history workflows.

**HIST-01 QA assessment:** **PASS for the exercised integrated Electron/Chromium scope.** This is not a native browser compatibility or full export-release assessment.

## TIME-01 Independent QA — visual multi-track increment

**Run date:** 2026-11-02  
**Scope:** Independent validation of TIME-01 implementation in the current repository. No product code was changed during this QA run.  
**Application:** `audio-video-creator` 1.0.0, Vite development server at `http://127.0.0.1:5173/`.

### Environment and safe media

| Item | Observed |
|---|---|
| Host | Windows (`Windows NT 10.0; Win64; x64`; exact OS build not exposed) |
| Browser/runtime | Integrated VS Code browser, Electron 43.8.3 / Chromium 150.0.7871.250; user-agent captured from the page |
| Node / npm | Node v24.12.0 / npm 11.6.2 |
| Automation | Integrated browser page with Playwright actions/evaluation; no repository-managed browser test harness |
| Media tools | FFmpeg/FFprobe not used; no independently saved export file was available for inspection |

Generated test inputs outside the repository in `%TEMP%\time01-fixtures`: a 4-second mono 22,050 Hz 440 Hz synthetic WAV, and two 160×90 solid-color synthetic PNGs (red and blue). No user or copyrighted media was used.

### Executed cases

| Test ID | Test / expected result | Actual result | Status |
|---|---|---|---|
| TIME01-PROJ-001 | Open a legacy schema-v1 project; migrate it to the default video track without losing clip order/timing; save and reopen. | Seeded a v1 IndexedDB fixture from the synthetic project (removed v2 `tracks`, `trackId`, and `timelinePosition` fields), then opened it through the UI. It reopened with one `Video 1` track and three clips at 0, 1.5, and 5 seconds (total 10 seconds). Autosave upgraded the stored document to schema v2 with the default track; after reload the project and positions remained. This exercises the migration path but is not a separately archived customer v1 file. | **PASS** |
| TIME01-TRK-001 | Create/select/rename a video track; locking prevents clip edits; hiding removes that track's preview layer. | Added `Video 2`, renamed it `Overlay QA`; selecting tracks changed `aria-pressed` exclusively (`[true,false]` then `[false,true]`). Locking disabled the clip on that track. Hiding the populated overlay reduced preview layers from two to one; the remaining sampled pixel was blue. Restored visibility and unlocked. | **PASS** |
| TIME01-DND-001 | Move a clip to another track by dragging; it should be assigned to the destination track. | A browser pointer drag (mouse down/move/up) moved clips between `Video 1` and `Overlay QA`; the source/destination row contents updated. The helper's `dragTo` attempt was inconsistent, so the successful evidence is from the explicit pointer drag. | **PASS** |
| TIME01-OVL-001 | Overlapping clips on separate tracks should render in track order in preview. | Set red overlay at t=1 and blue base clip at t=2; at t=2.5 preview showed two layers with z-indices 1/2. Pixel samples identified blue at z=1 and red at z=2. Hiding the upper track left the blue layer. | **PASS** |
| TIME01-NAV-001 | Click a ruler mark beyond the soundtrack; visuals remain positioned/visible, but navigation stays within the soundtrack boundary and the limit is explained. | Retested in integrated Chromium with a 4-second soundtrack and synthetic stills. The ruler retained marks beyond the boundary; clicking its 5-second mark left the playhead/preview at 4 seconds. The playhead slider max was 4 and End stayed at 4. The end marker read “Soundtrack ends at 0:04.0” and the warning stated that visuals after the soundtrack will not play or export in this iteration. Visual clip positions remained beyond the boundary. See the retest steps below. | **PASS** |
| TIME01-NAV-002 | Navigate the playhead within the allowed range and change timeline zoom. | Keyboard navigation moved the playhead to 2.5 seconds; zoom changed from 48 to 120 px/s and the displayed zoom value updated. | **PASS** |
| TIME01-SPLIT-001 | Split a selected clip at an interior playhead time; adjacent segments should preserve total duration. | With the red clip at t=1, split at t=2.5 produced 1.5-second and 3.5-second segments at t=1 and t=2.5. | **PASS** |
| TIME01-HIST-001 | Undo/redo the split and restore the corresponding clip state. | Undo restored the single 5-second segment; redo restored both split segments and returned Redo to disabled at the new history boundary. | **PASS** |
| TIME01-PERSIST-001 | Autosave and reload/reopen a multi-track edit without losing tracks or clip positions. | UI reported “Saved … in this browser.” Reopening the saved v2 project and reloading preserved the `Overlay QA`/`Video 1` tracks, clip positions, and split segments. | **PASS** |
| TIME01-EXP-001 | Render a synthetic overlapping composition; inspect the in-memory output Blob for basic decoding and a representative frame. | Create video completed. Captured Blob: 91,523 bytes, `video/mp4;codecs=avc1.42e01e,mp4a.40.2`; Chromium decoded it at 1920×1080, duration 4.0061 seconds, `readyState=4`. At t=2.2 the decoded pixel was `[218,37,34]` (red upper layer); MP4 bytes contained `vide` and `soun` markers. This is in-browser Blob evidence only. | **PASS (limited)** |
| TIME01-EXP-002 | Inspect a persisted downloaded file independently for decode, audio, timing, and export parity. | No downloaded file was captured or independently inspected; no FFmpeg/FFprobe run. The in-memory Blob result does not verify a saved file, audible audio/synchronization, or complete export parity. | **NOT TESTED** |
| TIME01-AUD-001 | Create and edit multiple audio clips/tracks. | Not implemented in the UI; it explicitly states that only one soundtrack is supported and multiple audio clips/tracks are not implemented. This is an open scope/acceptance gap, not a failed test of an implemented feature. | **NOT TESTED** |
| TIME01-DND-002 | Drag a clip horizontally to reposition it along the time axis. | Not tested. Numeric “Timeline position (sec)” controls were used to set overlapping clip positions; this does not verify time-axis drag repositioning. | **NOT TESTED** |
| TIME01-XBR-001 | Repeat critical timeline and media cases in native Chrome, Edge, Firefox, and Safari. | Only integrated Electron/Chromium on Windows was available and used. Native target browsers were not run. | **NOT TESTED** |

### TIME-01 execution totals

| Metric | Result |
|---|---:|
| Unique browser cases (latest status) | 14 |
| Passed | 10 |
| Failed | 0 |
| Blocked | 0 |
| Not tested | 4 |

### TIME-01 soundtrack boundary retest — integrated Chromium

**Run date:** 2026-11-02  
**Environment:** Integrated Chromium browser, Windows, `http://127.0.0.1:5173/` (local Vite server). Synthetic test media was generated outside the repository in `%TEMP%\time01-boundary-retest`: a 4-second mono WAV and two 160×90 solid-color BMP stills. No product code was changed.

| Test ID | Steps and expected result | Actual result | Status |
|---|---|---|---|
| TIME01-NAV-001 (retest) | Import the 4-second soundtrack and two stills. Verify clips can extend beyond 4 seconds and remain on the timeline; click a ruler mark past 4 seconds and attempt to move the playhead past the end. Verify the marker and warning explain the playback/export limit. | The stills were placed at 0s and 5s, each 5s long. Their timeline buttons remained at 0px and 240px (48px/s), and the ruler showed 0, 5, and 10 seconds despite the 4-second audio boundary. Clicking the 5-second ruler mark (its clamped accessible name was “Seek to 0:04.0”) set the playhead/preview to 4s. The playhead slider reported max=4; pressing End kept value=4. The marker title/label was “Soundtrack ends at 0:04.0”. The visible warning read: “One soundtrack is supported. Multiple audio clips and audio tracks are not implemented. Visual clips positioned after the soundtrack ends will not play or export in this iteration.” | **PASS** |
| TIME01-NAV-002 (retest) | Seek and play within the soundtrack range; playback should advance normally and remain bounded. | Used the timeline playhead slider to seek to 2.5s. It reported 2.5 and both overlapping visual layers were present. Play started the WAV (audio `paused=false`, currentTime≈2.99s); Pause stopped it (`paused=true`, currentTime≈3.03s). The playhead reached 3s, within the 4-second limit. | **PASS** |
| TIME01-OVL-001 (regression retest) | Place two clips so they overlap before and beyond the soundtrack end; the preview should show both in layer order. | Moved the second still from 5s to 2s using its Timeline position control. It remained visible on the timeline from 2s through 7s (left=96px, width=240px); at 2.5s/4s the preview contained both images, with layer z-indices 1 and 2. The overlap regression passed. | **PASS** |
| TIME01-PERSIST-001 (regression retest) | Save the timeline and reload; soundtrack boundary, visual positions, and media should persist. | Clicked Save and reloaded the page. Both stills and positions (0s and 2s), the 4-second soundtrack boundary marker, warning, and playhead max=4 were restored. | **PASS** |

**Retest outcome:** 4 cases executed; 4 passed, 0 failed, 0 blocked. The earlier TIME01-NAV-001 blocker was resolved by the implementation's explicit current-iteration contract and matching observed UI behavior. This verifies boundary navigation/communication, not that exports were independently inspected; saved-file export parity remains untested.

### Automated/build regression

| Check | Result |
|---|---|
| `npm test` | **PASS:** 33 tests, 0 failures, 0 skipped (run during this retest). Includes timeline boundary clamp, overlap/layering, split-at-absolute-time, project migration/storage, URL lifecycle, and history cases. |
| `npm run build` | **PASS:** `tsc -b` and Vite 8.3.5 production build completed; output bundle generated. |
| Regression observations | No regression observed in the retested in-range seek/playback, overlap preview, or save/reload flow. This remains integrated Chromium evidence only and does not establish native-browser compatibility or independent export correctness. |

### Open risks and QA assessment

- **Multi-audio remains unimplemented/open.** The current UI supports one soundtrack only; do not treat TIME-01's “multiple video and audio tracks” acceptance as met.
- **Horizontal drag repositioning remains unverified/open.** Cross-track dragging passed; changing the numeric timeline-position field is not equivalent to drag repositioning.
- **TIME01-NAV-001 is no longer blocked.** Integrated Chromium retest confirmed that visuals remain positioned beyond the 4-second soundtrack while ruler/playhead navigation is clamped, and both the end marker and warning state the current playback/export limit. TIME-01 as a whole remains in review for the separate gaps below.
- **Export claims remain open.** Only a Chromium-decoded in-memory MP4 Blob and a representative frame were checked. No saved download, independent media probe, audible-audio/sync check, or complete export parity was verified.
- **Native Chrome, Edge, Firefox, and Safari remain untested.**
- **TIME-01 is not complete.** Focused video-track tests passed, but the stated audio-track acceptance and the open cases above remain. The professional timeline must not be declared complete based only on this run.

**TIME-01 QA status:** **BLOCKED / IN_REVIEW** for full acceptance. The scoped, exercised video-track workflows passed; several required behaviors are unimplemented or unverified.

## TIME-02 — Clip and track operations (independent retest)

**Run date:** 2026-11-02  
**Scope:** Integrated-Chromium verification of horizontal drag/drop, grab-offset preservation, cross-track movement, source/destination track locking, snapping, duplication, overlap preview, undo/redo, local autosave/reload, and the existing soundtrack boundary. No product code was changed.

### Environment and fixture

| Item | Observed |
|---|---|
| Application | `audio-video-creator` 1.0.0 at `http://127.0.0.1:5173/`; Vite 8.3.5 |
| Browser | Integrated VS Code browser; Electron 43.8.3 / Chromium 150.0.7871.250 |
| Host | Windows; user-agent reports `Windows NT 10.0`; exact OS build not captured |
| Runtime/toolchain | Node v24.12.0; npm 11.6.2 |
| Media | `%TEMP%\time02-synthetic`: 4-second mono 22,050 Hz synthetic 440 Hz WAV and two 160×90 solid-color BMP stills |
| Test project | `TIME02-QA-2026-11-02`; saved in browser-local project storage for the reload check |
| Independent export inspection | Not run; no saved export was produced and FFmpeg/FFprobe were unavailable |

### Executed cases

| Test ID | Test / expected result | Actual result | Status |
|---|---|---|---|
| TIME02-DRAG-001 | Drag a clip horizontally from an offset point; its start should reflect the pointer drop minus the original grab offset. With snapping on, target 2.43s at 48 px/s. | The 5-second blue still moved to 2.4s. The drag began 120 px into the clip; the resulting position confirms the clip start, rather than the grabbed point, was placed at the snapped target. | **PASS** |
| TIME02-SNAP-002 | Disable snapping and place at 3.17s; re-enable snapping and place at 3.34s. | Snap off produced 3.17058s. Snap on produced 3.3s, on the 0.1-second grid. | **PASS** |
| TIME02-TRACK-003 | Drag the blue still from Video 1 to Video 2 at 4.2s. | Blue appeared on Video 2 at 4.2s and was removed from Video 1. The source grab point was deliberately placed in the blue clip’s unobscured region because the clips overlapped on Video 1. | **PASS** |
| TIME02-LOCK-004 | Lock the source track and attempt to drag its clip away; lock the destination and attempt to drop an unlocked clip onto it. Neither operation should move a clip. | A locked-source clip was disabled and `draggable=false`; its track and position remained unchanged. With Video 2 locked as destination, the red clip remained on Video 1 at 1.2s. | **PASS** |
| TIME02-DUP-005 | Duplicate a clip and verify a unique ID, adjacent placement, and preserved media/edit properties. | Blue source at 4.2s was set to 4s, Fade, zoom 1.4×, and horizontal position 10. Its duplicate had a different ID, the same asset, duration, transition, and transform, and began at 8.2s (immediately after the source). Verified in the autosaved IndexedDB document after its debounce completed. | **PASS** |
| TIME02-HIST-006 | Undo and redo the duplicate. | Video 2 clip count changed 2 → 1 on Undo → 2 on Redo. | **PASS** |
| TIME02-OVERLAP-007 | Overlap clips on separate tracks and inspect the preview at an in-range time. | At 2.5s, two image layers were visible with z-indices 1 and 2, consistent with the lower/higher track layering. | **PASS** |
| TIME02-SOUNDTRACK-008 | Preserve the soundtrack boundary while a visual clip remains beyond it. | With the 4-second WAV, the visual clip remained at 4.2s; playhead maximum/value were 4s, ruler navigation clamped to 4s, the soundtrack-end indicator was present, and the UI warned that later visuals will not play/export in this iteration. | **PASS** |
| TIME02-PERSIST-009 | Wait for local autosave, reload, and verify edits and boundary state recover. | UI reported the project saved locally. Reload restored both tracks, Video 2 positions 4.2s and 8.2s, the 4-second playhead maximum, and soundtrack-end indicator. | **PASS** |
| TIME02-MARK-010 | Validate user-created timeline marker workflows. | Not tested. The soundtrack-end boundary indicator is not evidence of user-created marker support. | **NOT TESTED** |
| TIME02-AUD-011 | Validate multiple audio clips/tracks. | Not tested; the UI explicitly says only one soundtrack is supported and multiple audio clips/tracks are not implemented. | **NOT TESTED** |
| TIME02-RIP-012 | Validate ripple/roll/group/link operations. | Not tested; these operations are explicitly deferred from the current task. | **NOT TESTED** |
| TIME02-XB-EXP-013 | Repeat in native Chrome/Edge/Firefox/Safari and inspect an independently saved export. | Not tested. Only integrated Chromium was available; no export file or FFmpeg/FFprobe inspection was performed. | **NOT TESTED** |

### TIME-02 execution totals and notes

| Metric | Result |
|---|---:|
| Unique case IDs (latest valid status) | 13 |
| Passed | 9 |
| Failed | 0 |
| Blocked | 0 |
| Not tested | 4 |

An initial exploratory drag attempt began in the portion of the blue clip obscured by the overlapping red clip, so it moved the red clip instead. Assertions that assumed the wrong clip/track then cascaded, and an early persistence read occurred before autosave completed. These were test-target/timing errors, not reproducible product defects. The affected operations were retested from unobscured clip regions, with autosave allowed to finish; the corrected observations above passed. No open TIME-02 product defect was identified in the requested workflows.

`npm test` **passed 36/36** (0 failures, 0 skipped). `npm run build` **passed** (`tsc -b` and Vite production build).

### Remaining limitations and QA assessment

- User-created markers and some requested track controls were not verified in the original TIME-02 run. A Nov 4 marker follow-up passed; mute/rename coverage remains incomplete.
- Multiple audio clips/tracks remain explicitly unimplemented; only one soundtrack is supported.
- Ripple/roll/group/link operations remain deferred.
- Native Chrome, Edge, Firefox, and Safari remain untested; these results apply only to integrated Electron/Chromium on Windows.
- Export correctness remains unverified for a persisted/downloaded file. No independent decode, audio/synchronization check, or export-parity check was performed.
- TIME-01 remains in review for broader multi-audio and export/browser gaps. Passing these focused TIME-02 cases does not establish full timeline or release acceptance.

**TIME-02 scoped QA status:** **PASS WITH WARNINGS** for the nine original workflows and the eight marker follow-up scenarios. Full task acceptance remains **IN_REVIEW** because track-control coverage, native browser runs, multi-audio, and saved-export validation remain open.

## Nov 4 Save As, marker, and current-workflow browser follow-up

**Environment:** Integrated VS Code browser, Electron 43.8.3 / Chromium 150.0.7871.250 on Windows; local Vite servers were started only for bounded tests and stopped afterward. QA used synthetic/in-memory WAV and SVG/PNG media only. No repository files were changed by the testers, and their saved projects were removed during cleanup.

### Save As selection regression

The broad 16-check pass found that Save As saved a distinct copy but kept the selector on the previously selected project, which could misdirect Open/Delete. The application was fixed to prefer the new ID when refreshing the project list.

| Follow-up check | Result |
|---|---|
| Save a seed project, then Save As under a distinct name | **PASS**; the newly-created ID and name became selected |
| Open the seed and then open the copy by selected ID | **PASS**; opened project names matched selected records |
| Delete the selected copy | **PASS**; confirmation named the copy and the deleted ID disappeared |
| Cleanup of synthetic saved records | **PASS**; no QA projects remained |

**Regression total:** 4 passed, 0 failed, 0 blocked. This is Chromium-only coverage, not native-browser coverage.

### Timeline marker browser verification

**Fixture:** 12-second synthetic WAV and 320×180 synthetic SVG; integrated Electron 43.8.3 / Chromium 150 on Windows.

| Test ID | Check | Observed result | Status |
|---|---|---|---|
| MARK-BRW-001 | Add marker at a nonzero playhead | At 5.0 sec, `Marker 1` appeared on the timeline at 0:05.0. | **PASS** |
| MARK-BRW-002 | Activate marker to seek | From 10.0 sec, activating the marker returned the playhead to 5.0 sec. | **PASS** |
| MARK-BRW-003 | Rename marker | Renamed to `QA Highlight`; timeline label and accessible name updated. | **PASS** |
| MARK-BRW-004 | Delete marker | Marker disappeared. | **PASS** |
| MARK-BRW-005 | Undo/redo rename and delete | Undo restored the prior label/marker; redo reapplied rename/deletion; final undo restored the marker. | **PASS** |
| MARK-BRW-006 | Autosave and reload/recovery | Reload restored the 5.0-sec `QA Highlight` marker and synthetic media. | **PASS** |
| MARK-BRW-007 | Open a saved project copy | The copy retained `QA Highlight` after another project was edited. | **PASS** |
| MARK-BRW-008 | Save As selector | The new `QA Marker Recovery` copy became selected. | **PASS** |

**Marker run total:** 8 passed, 0 failed, 0 blocked. Browser-only coverage is limited to integrated Chromium; native browsers and export behavior were not tested.

### Broad current-workflow follow-up

The bounded pass ran 16 checks: 12 passed, 1 failed, and 3 were blocked. Covered storage startup, Save As, autosave/reload, open/delete, visual-track creation and drag, split/duplicate, track visibility/lock, title timing/preview, and the export UI completion message. The failed check was the Save As selector issue above and passed its focused retest. Blocked checks were native file-picker import, downloaded-file inspection/decode, and native Chrome/Edge/Firefox/Safari. The export UI message is not proof of output correctness: no downloaded file was obtained for duration, dimensions, audio, sync, or title-pixel validation.

### MEDIA-01 import/library verification

**Implementation checks:** `npm test` passed **54/54** (timeline, schema/migrations/markers, storage, media validation, video/audio metadata timeouts, history, and title helpers); `npm run build` passed TypeScript and the Vite production build; `git diff --check` passed.

**Browser:** Integrated VS Code browser, Electron 43.8.3 / Chromium 150.0.7871.250 on Windows. The QA run used synthetic in-memory files and a bounded Vite server; no repository files were changed, QA project records were removed, and the server was stopped.

**Initial focused coverage:** 13 checks: 11 passed, 1 failed, 1 blocked. Synthetic WAV and PNG imported and appeared in the library with type/size and audio duration. Unsupported audio/visual extensions and conflicting MIME hints produced actionable feedback without altering existing project state. Corrupt PNG was rejected. Search filtered the library only; visual removal removed its clips and Undo restored them; soundtrack removal and Undo behaved as expected; Save/reload restored library entries and clip. The one UI gap—still image with no source-duration note—was corrected to display source duration N/A because images do not have intrinsic media duration. A synthetic `.webm` did not load, but that fixture was not known-decoded, so this is not evidence of valid video compatibility.

**Retest after fixes:** 6 checks passed: malformed `.webm` rejection completed in 312 ms, loading cleared, an actionable error appeared, existing soundtrack/image/clip remained, one created object URL was revoked, still source duration showed N/A, and search/remove/undo still worked. This malformed fixture triggered the browser decode-error event promptly, so the real-browser 12-second no-event timeout path was **not** exercised; its timeout/cleanup behavior is covered by unit tests. Audio metadata now has the same 12-second bound, unit-tested for success/error/timeout; its no-event timeout was not forced in browser either. No valid decodable video fixture was available. Other target browsers were not tested.

**MEDIA-01 status:** **IN_REVIEW**. The implemented import/library paths pass focused checks, but real decodable video formats and native browser behavior remain unverified. Extension/MIME acceptance is not a codec claim.

### Latest automated validation

On 2026-11-04, `npm test` passed **54/54** (0 failures) and `npm run build` passed TypeScript and the Vite production build. `git diff --check` passed.

## PREV-01 focused preview synchronization follow-up

**Implementation checks:** `npm test` passed **56/56** and `npm run build` passed. The preview keeps the existing 0.4-second playback correction tolerance and soundtrack master clock; it adds status feedback for video loading/error/playback rejection, pauses inactive layers, and distinguishes an empty project from a timeline gap/hidden video tracks. No frame-accuracy or cross-browser claim is made.

**Browser:** Integrated VS Code browser, Electron 43.8.3 / Chromium 150.0.7871.250 on Windows; synthetic WAV and PNG fixtures; bounded Vite server stopped after QA. FFmpeg/FFprobe and a browser-decodable synthetic video fixture were unavailable.

| Check | Result | Observation |
|---|---|---|
| Empty project vs. gap vs. hidden visual track | **PASS** | Empty project showed add-clips guidance; gaps and hidden tracks showed “No visible clips at this time.” |
| Title-only preview | **PASS** | A title rendered when no visual clips were active. |
| Overlapping image layers | **PASS** | Two image layers appeared; the higher visual track rendered above the lower one. |
| Soundtrack play/pause/end | **PASS** | Audio advanced and paused at its 4-second end. This does not establish video playback behavior. |
| Decode-error feedback | **PASS** | Invalid synthetic WebM was rejected with actionable import feedback. |
| Paused video scrubbing/source mapping/clip switch | **BLOCKED** | No decodable video fixture was available. |
| Active video leaves range and pauses | **BLOCKED** | Requires a decodable video fixture. |
| Playback rejection retry and stale status clearing | **BLOCKED** | The browser page became inaccessible before this check; reopening showed no saved project. |

**Run total:** 8 checks: 5 passed, 0 failed, 3 blocked. No confirmed product defect was observed. Video synchronization remains unverified; PREV-01 stays **IN_REVIEW**.

**Latest automated validation:** `npm test` passed **56/56**, `npm run build` passed, and `git diff --check` passed.

## PREV-01 decodable-video synchronization retest

**Run date:** 2026-11-04

**Environment:** Integrated VS Code browser, VS Code 1.145.0, Electron 43.8.3 / Chromium 150.0.7871.250 on Windows (`Win32`; exact OS build unknown); Node v24.12.0. Vite was started on localhost for this bounded test and stopped afterward.

**Synthetic fixtures:** A four-second mono 22,050 Hz WAV and a 320×180 synthetic PNG were created in memory. The app renderer exported and Chromium decoded a 61,367-byte `video/mp4;codecs=avc1.42e01e,mp4a.40.2` Blob, duration 4.034767 seconds, at 320×180. That Blob was re-imported into the editor as the video source. The fixture is valid for this browser but is renderer-derived and visually static; it is not an independently encoded moving-video or codec-compatibility fixture. An attempted direct Canvas/MediaRecorder WebM fixture failed Chromium demuxing and was discarded, not counted as an app defect.

| Test ID | Check | Observed result | Status |
|---|---|---|---|
| PREV-SYN-001 | Load the generated MP4 and set source In=0.5, Out=3.5 while paused at project time 0. | Metadata loaded (`readyState=4`); video duration was 4.034767 seconds. Preview source `currentTime` became 0.5 seconds and stayed paused. | **PASS** |
| PREV-SYN-002 | Seek the preview timeline to 1.2 seconds with source In=0.5. | Audio currentTime was 1.2 seconds and video currentTime was 1.7 seconds, matching source In + project time. | **PASS** |
| PREV-SYN-003 | Play from project time 0 and sample audio/video clocks. | At the observation, audio was 0.792233 seconds and video was 1.197904 seconds. Video was actively playing; observed video-audio offset was 0.405671 seconds versus the expected 0.5-second source offset (94 ms behind). | **PASS (observed sample; no project sync tolerance is defined)** |
| PREV-SYN-004 | Repeat a playback sample after seeking within the clip. | Audio was 1.885990 seconds and video was 2.308248 seconds. Observed offset was 0.422258 seconds (78 ms behind the expected 0.5-second source offset). | **PASS (observed sample; no project sync tolerance is defined)** |
| PREV-SYN-005 | Seek beyond the trimmed clip range to project time 3.2 seconds. | The clip ended at project time 3.0; preview showed the gap message and had no active video element. | **PASS** |
| PREV-SYN-006 | Play across the trimmed clip's out-point. | Starting near 2.8 seconds, audio advanced to 3.361420 seconds; the ended video was no longer active and the preview showed the gap state. | **PASS** |
| PREV-SYN-007 | Import a deliberately malformed MP4 while the valid video is already in the project. | The app displayed actionable decode-error feedback and retained the existing valid media and clip. | **PASS** |
| PREV-SYN-008 | Retry with the valid generated MP4 after the decode error. | The valid video imported; the previous error status cleared and the new clip appeared. | **PASS** |

**Run total:** 8 checks: 8 passed, 0 failed, 0 blocked. The project was a temporary synthetic test project and was deleted after the run; no source files were created in the repository. No application code was changed.

**Assessment:** This closes the previously blocked basic browser checks for paused source mapping, playback sampling, clip-range exit, and decode-error/retry status in this integrated Chromium environment. The two measured playback samples were 78–94 ms behind the expected 0.5-second source offset; no product sync tolerance has been approved, so this is evidence rather than a frame-accuracy or cross-browser guarantee. A renderer-derived static fixture does not establish synchronization with independently encoded moving video. Native Chrome/Edge/Firefox/Safari, audio/video sync over longer playback, and downloaded-export inspection remain open; PREV-01 and QA-01 remain **IN_REVIEW**.

**Final validation after this retest:** `npm test` and `npm run build` are recorded below after the documentation update; the Vite server was stopped at test completion.

## TIME-02 soundtrack-aware still durations

**Run date:** 2026-11-04
**Environment:** Windows 10, integrated Chromium/Chrome 150, React/Vite. The bounded Vite server was stopped after testing; port 5173 was verified clear.
**Fixtures:** In-browser generated 40-second and 55-second WAV files plus a 160×100 PNG; no repository fixtures were created.

| Test ID | Check | Observed result | Status |
|---|---|---|---|
| TIME02-STILL-001 | With no soundtrack, verify a still remains usable and Match soundtrack is unavailable. | Match soundtrack was disabled; switching to Custom and entering 12.5 seconds updated the still duration. | **PASS** |
| TIME02-STILL-002 | With 40s audio, choose Match soundtrack. | The still duration became 40.0 seconds. | **PASS** |
| TIME02-STILL-003 | Set Custom duration to 45 seconds. | The numeric field accepted 45 (maximum 86,400); timeline showed 45.0 seconds, with no 30-second clamp. | **PASS** |
| TIME02-STILL-004 | Replace audio with 55s audio in Custom mode, then choose Match. | Custom remained 45 seconds after replacement; Match updated it to 55.0 seconds. | **PASS** |
| TIME02-STILL-005 | Save and reload with Match active. | Reload restored Match mode and the 55.0-second duration. | **PASS** |

**Run total:** 5 checks: 5 passed, 0 failed, 0 blocked. No video-specific behavior or export was exercised. The automated duration helper uses the same `getClipDuration` consumed by timeline, preview, and export clip boundaries; actual export output was not validated. Export’s soundtrack-based end behavior remains unchanged by the implementation.

**Semantics:** `Match soundtrack` sets the still duration to the decoded soundtrack’s full duration and refreshes it when the audio is replaced. If duration is unavailable or audio is removed, the last usable stored duration is kept; selecting Match is disabled until a decoded duration is known. `Custom duration` is a numeric seconds value with a 0.1-second minimum, bounded so the clip end remains within 86,400 seconds total timeline time. A custom clip may end beyond the soundtrack; preview/timeline clip extent remains visible, but playback/export still stop at the soundtrack end. Existing v1–v4 projects migrate clips to Custom and preserve existing still durations. No image or video asset is duplicated.

**Automated validation:** `npm test` passed **58/58**, `npm run build` passed, and `git diff --check` passed. Native browsers, independently downloaded export validation, and export runtime beyond 30 seconds remain untested.

## TIME-02 matched still split regression

**Run date:** 2026-11-04
**Scope:** Automated timeline-helper regression; no browser or server was needed.

Splitting a still in Match soundtrack mode now converts both resulting clip segments to Custom, preserving their pre-split durations and adjacency. This prevents a future soundtrack replacement from expanding each half independently to the full soundtrack duration. A focused test uses a 40-second matched still, splits at 15 seconds, then applies a 55-second audio-duration update and verifies the segments remain 15 and 25 seconds. The same test verifies both segments are Custom; existing custom still and video source-range split assertions remain in the suite.

**Validation:** `npm test` passed **59/59**, `npm run build` passed, and `git diff --check` passed. No browser, export, or native-browser validation was performed for this helper-level change. TIME-02 remains **IN_REVIEW**; this increment does not close any broader timeline, preview, export, or release gate.

# Media limits and validation plan

**Product decision: PENDING_APPROVAL.** The nullable thresholds in `config/media-limits.json` are intentional. Existing engineering safeguards and model bounds are not promises about product support.

## Existing implementation behavior

- Import eligibility checks filename extension, non-empty file size, and compatible MIME hints before media decoding. An accepted extension does not guarantee that the current browser can decode the codec.
- Audio formats accepted by extension: `mp3`, `wav`, `aac`, `m4a`, `flac`, `ogg`, `wma`.
- Image formats accepted by extension: `jpg`, `jpeg`, `png`, `webp`, `bmp`.
- Video formats accepted by extension: `mp4`, `mov`, `webm`, `m4v`.
- Export formats are MP4 and WebM, subject to runtime `MediaRecorder` support checks and output validation.
- Audio/video metadata reads and image decoding are bounded. Export checks media capability, dimensions, and duration before download. This does not establish support across native browser targets.
- The existing engineering safety guards are centralized and apply before decoding media and to portable projects: 256 MiB per media item, 512 MiB aggregate source media, and 800 MiB per package file. These conservative technical guards are not validated product limits or claims; the product-approved thresholds remain pending.
- Project timeline fields have a structural upper bound of 86,400 seconds (24 hours). This schema bound is not a recommended or tested export duration.
- A 0.1-second export was observed to produce undecodable output and is now rejected. A 3-second integrated Chromium MP4 passed app-side dimension/duration/audio metadata validation. There is no approved minimum or maximum export duration.
- IndexedDB has browser/device-dependent quotas and eviction. No durable storage reservation or universal project-size capacity is claimed.

## How approved settings are enforced

After an authorized approval, set `status` to `APPROVED`, populate finite positive individual-file and total-project byte limits, a positive minimum export duration, and optionally a maximum export duration in `config/media-limits.json`. The total project limit must be at least the individual file limit; an optional maximum duration must exceed the minimum. Set `formatStatus` to `APPROVED` after reviewing the configurable `supportedFormats` arrays. The application applies approved file/project checks before media decode/import, approved format eligibility in file pickers/import validation/export settings, and approved duration checks before export. Pending numeric values do not impose an arbitrary product limit.

Configured format arrays must remain subsets of extensions/export formats implemented by the application; the release gate checks this. Runtime codec support is still checked separately. Do not advertise a format solely because its extension is listed.

## Required representative validation

Record browser/device versions, OS, source-file properties, sizes, durations, test outcome, observed peak memory where measurable, and actionable error behavior. Do not use personal media without authorization.

| Category | Required exercise | Current status |
|---|---|---|
| Small files | Import, edit, save/reload, export representative small audio/image/video sources. | **NOT_COMPLETED** for limit approval |
| Large files | Increase individual media sizes progressively around candidate thresholds; observe decode time, peak memory, UI responsiveness, failures, and cleanup. | **NOT_COMPLETED** |
| Multiple files | Add combinations of audio, images, and video; measure aggregate memory and project save/reload. | **NOT_COMPLETED** |
| Near project limit | Exercise projects below, at, and above proposed total bytes; verify pre-processing rejection, storage errors, and current-project preservation. | **NOT_COMPLETED** |
| Short exports | Test around the observed 0.1-second failure and candidate minimum; verify output decode and explicit failure. | **NOT_COMPLETED** |
| Long exports | Test progressively longer sequences at representative output dimensions and frame rates; verify output duration, audio, decode, cancellation, and memory behavior. | **NOT_COMPLETED** |
| Browser matrix | Test approved latest two stable Chrome/Edge/Firefox versions on Windows 11 and Safari on current/previous macOS releases, or obtain a product-approved revised matrix. | **BLOCKED** |
| Memory/performance | Measure representative devices and concurrent decoded media; record latency and peak memory without claiming generalization beyond tested equipment. | **NOT_COMPLETED** |
| Browser storage | Verify project bytes, quota errors, clearing site data, reload recovery, and failure preservation in each supported browser. | **NOT_COMPLETED** |

Approval requires every category in `config/media-limits.json` to be `PASSED`, test evidence links and a UTC test date, and an authorized product approver with rationale and date. No such decision or test result is currently recorded.

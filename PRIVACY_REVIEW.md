# Privacy review — draft for human review

**Status: NOT_STARTED. No legal/privacy owner or reviewer has been assigned. This draft is not legal advice, legal approval, or a compliance claim.**

## Observed technical behavior

- Projects and imported source-media `Blob`s are saved in the current browser profile using IndexedDB (`stillwave-projects` database, `projects` object store). The application does not send project media to a Stillwave backend; no backend upload endpoint exists in the audited repository.
- Autosave and project recovery after a page refresh are implemented. Data remains available only while browser storage is retained and accessible. Clearing this site’s/browser data deletes its IndexedDB projects. Browser quota limits, browser eviction, profile removal, or device loss can also make local projects unavailable. Users should retain originals and portable project backups.
- Portable project export creates a user-controlled local download. Import reads the selected package in the browser and saves its media to IndexedDB.
- Video export uses browser media APIs locally and downloads the resulting file. Browser codec support and behavior vary.
- The previous Google Fonts stylesheet request was removed. The app now uses system fonts; no external font request is made by the application stylesheet. This reduces application-originated third-party requests; it is not legal/privacy approval.
- No analytics, telemetry, application cookies, or additional third-party data requests were found in the audited application source. Hosting, DNS, CDN, error monitoring, or other services added by a future deployment provider are outside this source-only finding and must be reviewed separately.
- The app does not implement accounts, cloud sync, payments, or server-side project processing.

## Disclosure draft

> **Draft only — review and approve before publication.** This browser-based editor stores project information and imported media in your browser’s local IndexedDB storage so projects can be autosaved and recovered in that browser profile. The editor does not upload project media to a Stillwave application server. Browser storage can be limited or cleared by you or the browser, and may be evicted; clearing site data can remove saved projects. Keep your original media and export portable project backups. Video processing and export use browser capabilities and may consume substantial device memory and processing time. Supported codecs and results vary by browser.

The wording above describes observed implementation behavior, not a retention guarantee or a legal conclusion.

## Required human review record

Update `privacyReview` in `config/release-readiness.json` only after review:

- `owner`: accountable legal/privacy owner.
- `reviewer`: actual reviewer identity; must appear in protected `RELEASE_AUTHORIZED_PRIVACY_REVIEWERS`.
- `status`: `NOT_STARTED`, `IN_REVIEW`, `APPROVED`, or `CHANGES_REQUIRED`.
- `reviewDate`: UTC ISO timestamp for approval.
- `approvalNotes`: substantive review outcome and conditions.
- `policyUrls`: actual approved HTTPS policy links; no placeholders.

Review the data flow, disclosures, storage-clearing/data-loss behavior, media rights and user content, external network behavior after hosting is selected, applicable privacy/terms requirements, and the final public CTA. Do not mark the record approved until the named reviewer has made that decision.

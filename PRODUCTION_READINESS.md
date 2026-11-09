# Production readiness

**Current decision: BLOCKED.** The checked-in configuration intentionally contains no production URL, CTA, human approvals, approved media limits, or completed media-test evidence. Builds and automated tests are not release authorization.

## Audit

- **Architecture/build:** React 18 + TypeScript SPA, built with Vite. There is no client router, backend, deployment workflow, hosting-provider configuration, authentication service, or release approval system in the repository. `src/main.tsx` mounts the editor.
- **Navigation/CTA:** The editor had a placeholder `href="#"` brand link and no product landing page or external launch CTA. The editor’s “Create video” button starts export; it is not a public launch CTA.
- **Privacy/storage:** `src/services/projectStorage.ts` persists project metadata and source `Blob`s in IndexedDB. Autosave and recovery after refresh are implemented. Browser site-data clearing removes local projects; browser quota or eviction can also remove data. Users need to retain original media and portable backups. The app has no cloud/backend upload path.
- **Network/third parties:** The stylesheet previously fetched DM Sans from Google Fonts. That request has been removed in favor of a system font stack. No analytics, telemetry, cookie, or other application third-party request mechanism was found in the audited source. A production hosting provider may add its own network services and must be reviewed separately.
- **Media:** Extension/MIME eligibility checks precede metadata/decode work; actual codec support is browser-dependent. Audio/video metadata and image decode are bounded. IndexedDB storage has browser-managed quotas. Portable-package guards are 256 MiB per media item, 512 MiB total source media, and 800 MiB per package file; these are code safety guards, not user-approved limits. Timeline/project data has a structural 24-hour ceiling. A 0.1-second export was not decodable and is rejected; one integrated-runtime 3-second MP4 passed app-side output checks, but independent decoding and the approved native browser matrix remain outstanding.
- **Tests/releases:** Node test-runner tests and a TypeScript/Vite preview build exist. No deployment pipeline was found. New readiness tests and a Vite production-mode gate prevent the supported production build from succeeding without all required records and protected approver allowlists.

## Dashboard and gate commands

```sh
npm run readiness:dashboard
npm run readiness:check
npm test
npm run build                 # preview build; no public authorization
npm run release:beta          # gated PRIVATE_BETA build
npm run release:public        # gated PUBLIC build
```

`readiness:dashboard` creates a **local, read-only** report at `.production-readiness/dashboard.html`, outside `dist`; it has no approval controls and is ignored by Git. The source configurations and environment allowlists are read locally by the report. Never publish or copy the generated dashboard into the application bundle.

Both `npm run release:public` and direct `vite build --mode production` execute the same Vite gate. `npm run release:beta` / `vite build --mode private-beta` require separate beta authorization and still require approved privacy and media safety gates. `npm run build` explicitly creates a preview-mode artifact; it has no configured launch links/canonical URL. Non-preview, non-release build modes are rejected. Preview output must not be used as a substitute for an approved production release.

The repository has no hosting/deploy command to wire up. Any future deployment provider or workflow **must use the gated production-mode Vite build and fail deployment when that build fails**. Preview deployments must use preview mode and remain clearly identified/restricted by the hosting environment. Private-beta hosting also requires host-level access control; this browser-only app does not implement accounts or authorization.

## Configuration and approval record

Edit these checked-in files only after the appropriate human decision. Approval identities must also match protected environment allowlists; the allowlists are not stored in the repository.

- [`config/production.json`](./config/production.json): real production HTTPS URL, approved CTA label and same-origin HTTPS destination. URL placeholders, IP/localhost, dev/staging/preview hosts, credentials, query strings, and fragments are rejected. No destination is prefilled.
- [`config/release-readiness.json`](./config/release-readiness.json): selected release mode (`DEVELOPMENT`, `PRIVATE`, `PRIVATE_BETA`, `PUBLIC`), release approval record for the exact `package.json` version, and privacy-review record. Approval records require identity, UTC timestamp, conditions/notes, and applicable policy URLs.
- [`config/media-limits.json`](./config/media-limits.json): implemented format allowlists plus product limit decisions and evidence. Formats and thresholds are marked pending approval; nullable thresholds are not enforced as product limits until approved and validated.
- Protected build/deployment environment variables:
  - `RELEASE_AUTHORIZED_APPROVERS` — comma- or semicolon-separated release approver identities.
  - `RELEASE_AUTHORIZED_PRIVACY_REVIEWERS` — authorized legal/privacy reviewer identities.
  - `RELEASE_AUTHORIZED_MEDIA_APPROVERS` — authorized product/media-limit approver identities.

Set allowlists only in protected CI/deployment environments with appropriate access controls and review requirements. An identity in a config file alone is not authorization. Tests passing, a preview build, or a dashboard status cannot authorize a release.

## Current checklist

| Requirement | Status | What resolves it |
|---|---|---|
| Production URL | **BLOCKED — missing** | Product owner supplies the real production HTTPS origin in `config/production.json`. |
| CTA | **BLOCKED — missing** | Product owner approves the CTA wording and an HTTPS destination on that same origin. |
| Release authorization | **BLOCKED — pending** | Authorized release approver records mode, current app version, UTC timestamp, conditions, and identity; protected allowlist must include that person. |
| Legal/privacy owner | **BLOCKED — unassigned** | Assign an accountable owner in `config/release-readiness.json`. |
| Legal/privacy approval | **BLOCKED — not started** | Reviewer completes review, records notes/date and real policy URLs, marks `APPROVED`, and appears in the protected reviewer allowlist. This is human review, not a software compliance claim. |
| Media limits | **BLOCKED — pending approval** | Product owner approves measured file/project/duration limits and rationale, then records them and an authorized approver. |
| Media tests | **BLOCKED — not completed** | Complete every required scenario in [`MEDIA_LIMITS.md`](./MEDIA_LIMITS.md), record evidence, and set all required categories to `PASSED`. |
| Public release | **BLOCKED** | All preceding checks must pass for the exact release version and the production-mode build must succeed. |

`PRIVATE` and `DEVELOPMENT` are preview/development states only; they do not make `publicReady` true. `PRIVATE_BETA` requires its own explicit approval plus URL/CTA, privacy approval, and media approval/testing. It cannot waive privacy or safety gates.

## Steps from BLOCKED to READY

1. Supply and review the real production URL and CTA; configure them in `config/production.json`.
2. Assign the legal/privacy owner; complete the review and publish only real approved policy URLs.
3. Run the representative media plan on the approved browser/device matrix. Decide limits from measurements, then record approval and test evidence in `config/media-limits.json`.
4. Configure protected allowlists for release, privacy, and media approvers in the deployment environment.
5. Record a current-version release authorization, its timestamp, approver, mode, and conditions in `config/release-readiness.json`.
6. Run `npm test`, `npm run build`, `npm run readiness:check`, and `npm run release:public` in the protected release environment.
7. Configure the external deployment workflow to deploy only the artifact produced by the successful gated command; perform a post-deploy smoke check and retain release evidence.

**No legal compliance, target-browser compatibility, media-size guarantee, or public authorization is implied by implementing these checks.**

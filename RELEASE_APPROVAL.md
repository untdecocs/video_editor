# Release approval

**Current mode: PRIVATE. Public authorization: none. Do not publish.**

## Supported release modes

- `DEVELOPMENT` — local development and test workflows.
- `PRIVATE` — preview build only; not public-release authorization.
- `PRIVATE_BETA` — a separately authorized beta build, still subject to URL/CTA, approved privacy review, approved media limits, and completed representative media tests. The hosting environment must enforce access control; this browser-only application has no accounts/authentication.
- `PUBLIC` — requires every readiness gate and an explicit, authorized approval for the exact app version.

The checked-in mode is intentionally `PRIVATE`. No approver identity or timestamp is supplied.

## Public approval record

An authorized approver records `publicAuthorization` in `config/release-readiness.json` with:

- `mode`: `PUBLIC`.
- `applicationVersion`: exact `version` from `package.json`.
- `approverIdentity`: actual approver identity.
- `approvalTimestamp`: UTC ISO timestamp, not a future time.
- `conditions`: explicit conditions, or the statement `No additional conditions`.

The identity must be included in protected `RELEASE_AUTHORIZED_APPROVERS`. A config-file entry alone cannot authorize release. Protected deployment environment access and human approval controls must be configured outside this repository.

For private beta, record a separate `privateBetaAuthorization` object with mode `PRIVATE_BETA`; the same identity, version, timestamp, conditions, and allowlist checks apply. Beta does not waive privacy or media safety requirements.

## Build and deployment enforcement

- `npm run build` / `npm run build:preview` creates a preview-mode build. Production links/CTA/canonical metadata are not emitted in preview mode. This command does not authorize or deploy a release.
- `npm run release:public` runs TypeScript validation and `vite build --mode production`. A Vite config hook independently reads all readiness records and protected approver allowlists and fails the build if mode, authorization, privacy, or media checks are incomplete.
- `npm run release:beta` builds `--mode private-beta` and requires its separate explicit authorization plus approved privacy/media gates.
- A direct `vite build --mode production` or `vite build --mode private-beta` is guarded by the same hook; there is no separate unguarded production Vite configuration in the repository.
- No deployment provider or CI/CD workflow exists in this repository. A future host pipeline must deploy only the gated artifact and fail closed on build errors. Preview output must never be treated as public approval. Configure protected environments/reviewers and access restrictions in the hosting system.

Useful commands:

```sh
npm run readiness:dashboard
npm run readiness:check
npm test
npm run build
npm run release:public
```

The readiness dashboard is read-only and generated under `.production-readiness/`, outside the public `dist` directory. Automated tests and successful preview builds never change an approval record or authorize publication.

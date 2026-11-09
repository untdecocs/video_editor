import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReleaseAllowed, evaluateReadiness, MEDIA_TEST_CASES } from './readiness.mjs';
import { PORTABLE_PACKAGE_SAFETY_LIMITS } from '../src/services/mediaSafetyLimits.js';

const now = Date.parse('2026-11-09T12:00:00Z');
const production = {
  productionUrl: 'https://studio.stillwave.com',
  cta: { label: 'Open editor', destination: 'https://studio.stillwave.com/editor' },
};

function createReadyInputs() {
  return {
    production: structuredClone(production),
    release: {
      mode: 'PUBLIC',
      publicAuthorization: {
        mode: 'PUBLIC',
        applicationVersion: '1.0.0',
        approverIdentity: 'launch-owner@example.com',
        approvalTimestamp: '2026-11-09T10:00:00Z',
        conditions: ['No additional conditions'],
      },
      privacyReview: {
        owner: 'privacy-owner@example.com',
        reviewer: 'privacy-reviewer@example.com',
        status: 'APPROVED',
        reviewDate: '2026-11-09T10:00:00Z',
        approvalNotes: 'Reviewed the data flows and disclosures.',
        policyUrls: ['https://studio.stillwave.com/privacy'],
      },
    },
    media: {
      status: 'APPROVED',
      approvedBy: 'product-owner@example.com',
      approvedAt: '2026-11-09T10:00:00Z',
      approvalNotes: 'Reviewed representative media benchmarks.',
      formatStatus: 'APPROVED',
      supportedFormats: {
        audio: ['mp3', 'wav'],
        image: ['png'],
        video: ['mp4'],
        export: ['MP4'],
      },
      maxIndividualMediaFileBytes: 10_000_000,
      maxTotalProjectBytes: 50_000_000,
      minimumExportDurationSeconds: 1,
      maximumExportDurationSeconds: null,
      testStatus: 'PASSED',
      tests: Object.fromEntries(MEDIA_TEST_CASES.map((key) => [key, 'PASSED'])),
      testedAt: '2026-11-09T10:00:00Z',
      testEvidence: ['TEST_RESULTS.md#media-limit-validation'],
    },
    appVersion: '1.0.0',
    authorizedApprovers: ['launch-owner@example.com'],
    authorizedPrivacyReviewers: ['privacy-reviewer@example.com'],
    authorizedMediaApprovers: ['product-owner@example.com'],
    now,
  };
}

test('blocks a missing production URL', () => {
  const input = createReadyInputs();
  input.production.productionUrl = null;
  const result = evaluateReadiness(input);
  assert.equal(result.checks.productionUrl.status, 'pending');
  assert.equal(result.eligible, false);
});

test('blocks an invalid production URL', () => {
  const input = createReadyInputs();
  input.production.productionUrl = 'http://localhost:5173';
  const result = evaluateReadiness(input);
  assert.equal(result.checks.productionUrl.status, 'pending');
  assert.equal(result.eligible, false);
});

test('blocks a missing CTA', () => {
  const input = createReadyInputs();
  input.production.cta.label = null;
  const result = evaluateReadiness(input);
  assert.equal(result.checks.cta.status, 'pending');
});

test('blocks missing or unauthorized release approval', () => {
  const missing = createReadyInputs();
  missing.release.publicAuthorization = null;
  assert.equal(evaluateReadiness(missing).checks.releaseAuthorization.status, 'pending');
  const unauthorized = createReadyInputs();
  unauthorized.authorizedApprovers = [];
  assert.equal(evaluateReadiness(unauthorized).checks.releaseAuthorization.status, 'failed');
});

test('blocks missing legal/privacy owner and pending privacy review', () => {
  const input = createReadyInputs();
  input.release.privacyReview.owner = null;
  input.release.privacyReview.status = 'IN_REVIEW';
  const result = evaluateReadiness(input);
  assert.equal(result.checks.privacyOwner.status, 'pending');
  assert.equal(result.checks.privacyReview.status, 'pending');
});

test('blocks unapproved media limits and failed media tests', () => {
  const pending = createReadyInputs();
  pending.media.status = 'PENDING_APPROVAL';
  assert.equal(evaluateReadiness(pending).checks.mediaLimits.status, 'pending');
  const failed = createReadyInputs();
  failed.media.tests.shortExports = 'FAILED';
  assert.equal(evaluateReadiness(failed).checks.mediaTesting.status, 'failed');
});

test('rejects formats that are not implemented by the application', () => {
  const input = createReadyInputs();
  input.media.supportedFormats.video = ['unsupported'];
  assert.equal(evaluateReadiness(input).checks.mediaLimits.status, 'failed');
});

test('rejects approved limits beyond existing technical safety guards', () => {
  const fileLimitInput = createReadyInputs();
  fileLimitInput.media.maxIndividualMediaFileBytes = PORTABLE_PACKAGE_SAFETY_LIMITS.maxIndividualMediaBytes + 1;
  assert.equal(evaluateReadiness(fileLimitInput).checks.mediaLimits.status, 'failed');
  const durationInput = createReadyInputs();
  durationInput.media.maximumExportDurationSeconds = PORTABLE_PACKAGE_SAFETY_LIMITS.maxTimelineDurationSeconds + 1;
  assert.equal(evaluateReadiness(durationInput).checks.mediaLimits.status, 'failed');
});

test('allows PUBLIC only when every required approval and test is valid', () => {
  const result = evaluateReadiness(createReadyInputs());
  assert.equal(result.eligible, true);
  assert.equal(result.publicReady, true);
  assert.equal(result.status, 'READY');
  assert.doesNotThrow(() => assertReleaseAllowed(result, 'PUBLIC'));
});

test('prevents a preview/private config from bypassing the public release gate', () => {
  const input = createReadyInputs();
  input.release.mode = 'PRIVATE';
  const result = evaluateReadiness(input);
  assert.equal(result.publicReady, false);
  assert.throws(() => assertReleaseAllowed(result, 'PUBLIC'), /not PUBLIC/);
});

test('private beta cannot waive privacy or media safety gates', () => {
  const input = createReadyInputs();
  input.release.mode = 'PRIVATE_BETA';
  input.release.privateBetaAuthorization = {
    ...input.release.publicAuthorization,
    mode: 'PRIVATE_BETA',
  };
  input.release.privacyReview.status = 'IN_REVIEW';
  const result = evaluateReadiness(input);
  assert.equal(result.eligible, false);
  assert.throws(() => assertReleaseAllowed(result, 'PRIVATE_BETA'), /privacyReview/);
});

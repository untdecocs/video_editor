import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDurationAgainstApprovedLimits, validateMediaAgainstApprovedLimits, validateMediaAgainstSafetyLimits } from './mediaLimitValidation.js';

const pending = {
  status: 'PENDING_APPROVAL',
  maxIndividualMediaFileBytes: null,
  maxTotalProjectBytes: null,
  minimumExportDurationSeconds: null,
  maximumExportDurationSeconds: null,
};

const approved = {
  status: 'APPROVED',
  maxIndividualMediaFileBytes: 100,
  maxTotalProjectBytes: 150,
  minimumExportDurationSeconds: 1,
  maximumExportDurationSeconds: 60,
};

test('does not enforce proposed media limits before product approval', () => {
  assert.equal(validateMediaAgainstApprovedLimits({ name: 'large.wav', size: 10_000 }, 10_000, 'audio', pending), null);
  assert.equal(validateDurationAgainstApprovedLimits(0.01, pending), null);
});

test('enforces existing engineering safety guards before media processing', () => {
  const safetyLimits = { maxIndividualMediaBytes: 100, maxTotalProjectMediaBytes: 150 };
  assert.match(validateMediaAgainstSafetyLimits({ name: 'large.wav', size: 101 }, 0, 'audio', safetyLimits), /technical guard is not an approved product limit/);
  assert.match(validateMediaAgainstSafetyLimits({ name: 'next.png', size: 51 }, 100, 'visual', safetyLimits), /project-media processing safety guard/);
  assert.equal(validateMediaAgainstSafetyLimits({ name: 'ok.png', size: 50 }, 100, 'visual', safetyLimits), null);
});

test('enforces approved per-file and total-project media limits before processing', () => {
  assert.match(validateMediaAgainstApprovedLimits({ name: 'large.wav', size: 101 }, 0, 'audio', approved), /approved audio file-size limit/);
  assert.match(validateMediaAgainstApprovedLimits({ name: 'next.png', size: 51 }, 100, 'visual', approved), /total project-media limit/);
  assert.equal(validateMediaAgainstApprovedLimits({ name: 'ok.png', size: 50 }, 100, 'visual', approved), null);
});

test('enforces approved export-duration bounds', () => {
  assert.match(validateDurationAgainstApprovedLimits(0.5, approved), /approved minimum/);
  assert.match(validateDurationAgainstApprovedLimits(61, approved), /approved maximum/);
  assert.equal(validateDurationAgainstApprovedLimits(30, approved), null);
});

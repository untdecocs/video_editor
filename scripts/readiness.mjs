import { validateCtaDestination, validateProductionUrl } from '../src/config/productionUrl.js';
import { PORTABLE_PACKAGE_SAFETY_LIMITS } from '../src/services/mediaSafetyLimits.js';

export const RELEASE_MODES = Object.freeze(['DEVELOPMENT', 'PRIVATE', 'PRIVATE_BETA', 'PUBLIC']);
export const PRIVACY_REVIEW_STATUSES = Object.freeze(['NOT_STARTED', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUIRED']);
export const MEDIA_TEST_CASES = Object.freeze([
  'smallMediaFiles',
  'largeMediaFiles',
  'multipleMediaFiles',
  'nearProjectLimit',
  'shortExports',
  'longExports',
  'supportedBrowserMatrix',
  'memoryAndPerformance',
  'browserStorageConstraints',
]);
const IMPLEMENTED_FORMATS = Object.freeze({
  audio: new Set(['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma']),
  image: new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp']),
  video: new Set(['mp4', 'mov', 'webm', 'm4v']),
  export: new Set(['MP4', 'WebM']),
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identityInAllowlist(identity, allowlist) {
  if (typeof identity !== 'string' || !identity.trim()) return false;
  const normalized = identity.trim().toLocaleLowerCase();
  return allowlist.some((item) => item.trim().toLocaleLowerCase() === normalized);
}

function parseAllowlist(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (typeof value !== 'string') return [];
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}

function validApprovalDate(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now;
}

function check(status, detail) {
  return { status, detail };
}

function validPolicyUrl(value) {
  return validateProductionUrl(value).valid;
}

function configuredUrlCheck(production) {
  const result = validateProductionUrl(production?.productionUrl);
  return result.valid
    ? check('ready', `Configured production origin: ${result.url.origin}`)
    : check('pending', result.message);
}

function ctaCheck(production) {
  const label = production?.cta?.label;
  if (typeof label !== 'string' || !label.trim()) return check('pending', 'Configure a concise, approved call-to-action label.');
  const result = validateCtaDestination(production?.cta?.destination, production?.productionUrl);
  return result.valid
    ? check('ready', `“${label.trim()}” points to ${result.url.href}`)
    : check('pending', result.message);
}

function authorizationCheck(authorization, expectedMode, appVersion, allowlist, now) {
  if (!isRecord(authorization)) return check('pending', `No ${expectedMode} release authorization is recorded.`);
  if (authorization.mode !== expectedMode) return check('failed', `Authorization mode must be ${expectedMode}.`);
  if (authorization.applicationVersion !== appVersion) return check('failed', 'Authorization must name the exact application version being released.');
  if (!identityInAllowlist(authorization.approverIdentity, allowlist)) {
    return check('failed', 'Approver is missing or is not in the protected release-approver allowlist.');
  }
  if (!validApprovalDate(authorization.approvalTimestamp, now)) {
    return check('failed', 'Approval timestamp must be a valid UTC time that is not in the future.');
  }
  const conditions = Array.isArray(authorization.conditions)
    ? authorization.conditions.filter((item) => typeof item === 'string' && item.trim())
    : typeof authorization.conditions === 'string' && authorization.conditions.trim()
      ? [authorization.conditions.trim()]
      : [];
  if (!conditions.length) return check('failed', 'Record the approval conditions or explicitly state “No additional conditions”.');
  return check('ready', `Version ${appVersion} authorized by ${authorization.approverIdentity.trim()}.`);
}

function privacyOwnerCheck(privacy) {
  return typeof privacy?.owner === 'string' && privacy.owner.trim()
    ? check('ready', `Owner assigned: ${privacy.owner.trim()}.`)
    : check('pending', 'Assign an accountable legal/privacy owner.');
}

function privacyApprovalCheck(privacy, allowlist, now) {
  if (!isRecord(privacy)) return check('pending', 'No legal/privacy review record exists.');
  if (!PRIVACY_REVIEW_STATUSES.includes(privacy.status)) return check('failed', 'Privacy review status is invalid.');
  if (privacy.status !== 'APPROVED') {
    return check('pending', `Legal/privacy review status is ${privacy.status}; explicit human approval is required.`);
  }
  if (!identityInAllowlist(privacy.reviewer, allowlist)) return check('failed', 'Privacy reviewer is missing or is not in the protected reviewer allowlist.');
  if (!validApprovalDate(privacy.reviewDate, now)) return check('failed', 'Approved review date must be a valid UTC time that is not in the future.');
  if (typeof privacy.approvalNotes !== 'string' || !privacy.approvalNotes.trim()) return check('failed', 'Record the privacy reviewer’s approval notes.');
  if (!Array.isArray(privacy.policyUrls) || !privacy.policyUrls.length || !privacy.policyUrls.every(validPolicyUrl)) {
    return check('failed', 'Add valid, real HTTPS policy URLs; placeholder URLs are not accepted.');
  }
  return check('ready', `Review approved by ${privacy.reviewer.trim()} on ${privacy.reviewDate}.`);
}

function mediaLimitsCheck(media, allowlist, now) {
  if (!isRecord(media) || media.status !== 'APPROVED') {
    return check('pending', 'Media limits are PENDING_APPROVAL; record evidence-based limits and an authorized product decision.');
  }
  if (!identityInAllowlist(media.approvedBy, allowlist)) return check('failed', 'Media-limit approver is missing or not authorized.');
  if (!validApprovalDate(media.approvedAt, now)) return check('failed', 'Media-limit approval date must be a valid UTC time that is not in the future.');
  if (typeof media.approvalNotes !== 'string' || !media.approvalNotes.trim()) return check('failed', 'Record the rationale and approval notes for the media limits.');
  const positiveValues = [
    media.maxIndividualMediaFileBytes,
    media.maxTotalProjectBytes,
    media.minimumExportDurationSeconds,
  ];
  if (positiveValues.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
    return check('failed', 'Approved file, project, and minimum export limits must be finite positive numbers.');
  }
  if (media.maxTotalProjectBytes < media.maxIndividualMediaFileBytes) {
    return check('failed', 'Maximum total project media must be at least as large as the individual file limit.');
  }
  if (media.maxIndividualMediaFileBytes > PORTABLE_PACKAGE_SAFETY_LIMITS.maxIndividualMediaBytes
    || media.maxTotalProjectBytes > PORTABLE_PACKAGE_SAFETY_LIMITS.maxTotalProjectMediaBytes) {
    return check('failed', 'Approved media limits exceed the current technical processing/package safety guards; engineering must revise the guards and retest before approval.');
  }
  if (media.formatStatus !== 'APPROVED') return check('pending', 'Supported media/export formats have not been approved.');
  if (!isRecord(media.supportedFormats)
    || Object.entries(IMPLEMENTED_FORMATS).some(([kind, implemented]) => {
      const formats = media.supportedFormats[kind];
      return !Array.isArray(formats) || formats.length === 0
        || formats.some((format) => typeof format !== 'string' || !implemented.has(format));
    })) {
    return check('failed', 'Configured formats must be non-empty subsets of formats implemented by the application.');
  }
  if (media.maximumExportDurationSeconds !== null
    && (typeof media.maximumExportDurationSeconds !== 'number'
      || !Number.isFinite(media.maximumExportDurationSeconds)
      || media.maximumExportDurationSeconds <= media.minimumExportDurationSeconds)) {
    return check('failed', 'Maximum export duration must be null (no product maximum) or greater than the minimum.');
  }
  if (media.minimumExportDurationSeconds > PORTABLE_PACKAGE_SAFETY_LIMITS.maxTimelineDurationSeconds
    || (media.maximumExportDurationSeconds !== null
      && media.maximumExportDurationSeconds > PORTABLE_PACKAGE_SAFETY_LIMITS.maxTimelineDurationSeconds)) {
    return check('failed', 'Approved export durations exceed the application’s existing 24-hour project timeline ceiling.');
  }
  return check('ready', `Approved by ${media.approvedBy.trim()}; file/project/export limits are recorded.`);
}

function mediaTestsCheck(media, now) {
  if (!isRecord(media) || media.testStatus !== 'PASSED') {
    return check(media?.testStatus === 'FAILED' ? 'failed' : 'pending', `Media test status is ${media?.testStatus ?? 'NOT_COMPLETED'}.`);
  }
  const incomplete = MEDIA_TEST_CASES.filter((key) => media.tests?.[key] !== 'PASSED');
  if (incomplete.length) return check('failed', `Required media test cases are incomplete or failed: ${incomplete.join(', ')}.`);
  if (!validApprovalDate(media.testedAt, now)) return check('failed', 'Record a valid UTC test completion time.');
  if (!Array.isArray(media.testEvidence) || !media.testEvidence.length
    || media.testEvidence.some((item) => typeof item !== 'string' || !item.trim())) {
    return check('failed', 'Link repeatable test evidence before marking media validation passed.');
  }
  return check('ready', 'All required representative media-test categories passed with evidence.');
}

export function evaluateReadiness({
  production,
  release,
  media,
  appVersion,
  authorizedApprovers = [],
  authorizedPrivacyReviewers = [],
  authorizedMediaApprovers = [],
  now = Date.now(),
}) {
  const mode = release?.mode;
  const modeValid = RELEASE_MODES.includes(mode);
  const authorization = mode === 'PRIVATE_BETA' ? release?.privateBetaAuthorization : release?.publicAuthorization;
  const authorizationResult = modeValid && (mode === 'PUBLIC' || mode === 'PRIVATE_BETA')
    ? authorizationCheck(authorization, mode, appVersion, parseAllowlist(authorizedApprovers), now)
    : modeValid
      ? check('pending', `Configured release mode is ${mode}; this does not authorize public production.`)
      : check('failed', 'Release mode must be DEVELOPMENT, PRIVATE, PRIVATE_BETA, or PUBLIC.');
  const privacy = release?.privacyReview;
  const mediaApproved = mediaLimitsCheck(media, parseAllowlist(authorizedMediaApprovers), now);
  const mediaTested = mediaTestsCheck(media, now);
  const checks = {
    productionUrl: configuredUrlCheck(production),
    cta: ctaCheck(production),
    releaseAuthorization: authorizationResult,
    privacyOwner: privacyOwnerCheck(privacy),
    privacyReview: privacyApprovalCheck(privacy, parseAllowlist(authorizedPrivacyReviewers), now),
    mediaLimits: mediaApproved,
    mediaTesting: mediaTested,
  };
  const publicRequirements = Object.values(checks).every((item) => item.status === 'ready');
  const privateBetaRequirements = checks.productionUrl.status === 'ready'
    && checks.cta.status === 'ready'
    && checks.releaseAuthorization.status === 'ready'
    && checks.privacyOwner.status === 'ready'
    && checks.privacyReview.status === 'ready'
    && checks.mediaLimits.status === 'ready'
    && checks.mediaTesting.status === 'ready';
  const eligible = mode === 'PUBLIC'
    ? publicRequirements
    : mode === 'PRIVATE_BETA'
      ? privateBetaRequirements
      : modeValid && (mode === 'DEVELOPMENT' || mode === 'PRIVATE');
  return {
    mode: modeValid ? mode : 'INVALID',
    checks,
    eligible,
    publicReady: mode === 'PUBLIC' && publicRequirements,
    status: eligible ? 'READY' : 'BLOCKED',
  };
}

export function assertReleaseAllowed(evaluation, requestedMode) {
  if (!RELEASE_MODES.includes(requestedMode)) {
    throw new Error(`Unknown release mode "${requestedMode}".`);
  }
  if (requestedMode === 'DEVELOPMENT' || requestedMode === 'PRIVATE') return;
  if (evaluation.mode !== requestedMode) {
    throw new Error(`Release blocked: readiness config is ${evaluation.mode}, not ${requestedMode}.`);
  }
  if (!evaluation.eligible) {
    const missing = Object.entries(evaluation.checks)
      .filter(([, result]) => result.status !== 'ready')
      .map(([key, result]) => `${key}: ${result.detail}`);
    throw new Error(`Release blocked. Resolve these readiness gates:\n- ${missing.join('\n- ')}`);
  }
}

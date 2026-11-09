export type ReadinessStatus = 'ready' | 'pending' | 'failed';

export type ReadinessEvaluation = {
  mode: string;
  checks: Record<string, { status: ReadinessStatus; detail: string }>;
  eligible: boolean;
  publicReady: boolean;
  status: 'READY' | 'BLOCKED';
};

export const RELEASE_MODES: readonly string[];
export const PRIVACY_REVIEW_STATUSES: readonly string[];
export const MEDIA_TEST_CASES: readonly string[];

export function evaluateReadiness(input: {
  production: unknown;
  release: unknown;
  media: unknown;
  appVersion: string;
  authorizedApprovers?: string | readonly string[];
  authorizedPrivacyReviewers?: string | readonly string[];
  authorizedMediaApprovers?: string | readonly string[];
  now?: number;
}): ReadinessEvaluation;

export function assertReleaseAllowed(evaluation: ReadinessEvaluation, requestedMode: string): void;

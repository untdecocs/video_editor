import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateReadiness } from './readiness.mjs';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read readiness configuration "${path}": ${detail}`);
  }
}

export function loadReadiness(projectRoot, environment = process.env) {
  const production = readJson(resolve(projectRoot, 'config/production.json'));
  const release = readJson(resolve(projectRoot, 'config/release-readiness.json'));
  const media = readJson(resolve(projectRoot, 'config/media-limits.json'));
  const packageInfo = readJson(resolve(projectRoot, 'package.json'));
  const evaluation = evaluateReadiness({
    production,
    release,
    media,
    appVersion: packageInfo.version,
    authorizedApprovers: environment.RELEASE_AUTHORIZED_APPROVERS,
    authorizedPrivacyReviewers: environment.RELEASE_AUTHORIZED_PRIVACY_REVIEWERS,
    authorizedMediaApprovers: environment.RELEASE_AUTHORIZED_MEDIA_APPROVERS,
  });
  return { production, release, media, appVersion: packageInfo.version, evaluation };
}

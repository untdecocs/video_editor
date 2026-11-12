import mediaLimits from '../../config/media-limits.json';
import { validateDurationAgainstApprovedLimits, validateMediaAgainstApprovedLimits, validateMediaAgainstSafetyLimits } from './mediaLimitValidation.js';
import { PORTABLE_PACKAGE_SAFETY_LIMITS } from './mediaSafetyLimits.js';
export { PORTABLE_PACKAGE_SAFETY_LIMITS } from './mediaSafetyLimits.js';
import type { MediaImportKind } from './media';

export type ApprovedMediaLimits = typeof mediaLimits;
export const APPROVED_MEDIA_LIMITS = mediaLimits;

export function getProjectMediaBytes(
  audioFiles: Pick<File, 'size'> | null | readonly Pick<File, 'size'>[],
  assets: readonly { file: Pick<File, 'size'> }[],
): number {
  const audioSize = audioFiles === null
    ? 0
    : 'size' in audioFiles
      ? audioFiles.size
      : audioFiles.reduce((total, file) => total + file.size, 0);
  return audioSize + assets.reduce((total, asset) => total + asset.file.size, 0);
}

export function validateApprovedMediaFile(
  file: Pick<File, 'name' | 'size'>,
  currentProjectMediaBytes: number,
  kind: MediaImportKind,
): string | null {
  const safetyError = validateMediaAgainstSafetyLimits(file, currentProjectMediaBytes, kind, PORTABLE_PACKAGE_SAFETY_LIMITS);
  if (safetyError) return safetyError;
  return validateMediaAgainstApprovedLimits(file, currentProjectMediaBytes, kind, mediaLimits);
}

export function validateApprovedExportDuration(durationSeconds: number): string | null {
  return validateDurationAgainstApprovedLimits(durationSeconds, mediaLimits);
}

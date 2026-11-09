type MediaLimitConfiguration = {
  status: string;
  maxIndividualMediaFileBytes: number | null;
  maxTotalProjectBytes: number | null;
  minimumExportDurationSeconds: number | null;
  maximumExportDurationSeconds: number | null;
};

export function validateMediaAgainstSafetyLimits(
  file: Pick<File, 'name' | 'size'>,
  currentProjectMediaBytes: number,
  kind: 'audio' | 'visual',
  safetyLimits: { maxIndividualMediaBytes: number; maxTotalProjectMediaBytes: number },
): string | null;

export function validateMediaAgainstApprovedLimits(
  file: Pick<File, 'name' | 'size'>,
  currentProjectMediaBytes: number,
  kind: 'audio' | 'visual',
  limits: MediaLimitConfiguration,
): string | null;

export function validateDurationAgainstApprovedLimits(durationSeconds: number, limits: MediaLimitConfiguration): string | null;

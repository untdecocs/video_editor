export function validateMediaAgainstSafetyLimits(file, currentProjectMediaBytes, kind, safetyLimits) {
  if (file.size > safetyLimits.maxIndividualMediaBytes) {
    return `"${file.name}" exceeds the current ${kind} processing safety guard. This technical guard is not an approved product limit; choose a smaller file and keep the original.`;
  }
  if (currentProjectMediaBytes + file.size > safetyLimits.maxTotalProjectMediaBytes) {
    return `"${file.name}" would exceed the current project-media processing safety guard. This technical guard is not an approved product limit; remove media or choose a smaller copy.`;
  }
  return null;
}

export function validateMediaAgainstApprovedLimits(file, currentProjectMediaBytes, kind, limits) {
  if (limits.status !== 'APPROVED') return null;
  if (Number.isFinite(limits.maxIndividualMediaFileBytes)
    && limits.maxIndividualMediaFileBytes !== null
    && file.size > limits.maxIndividualMediaFileBytes) {
    return `"${file.name}" exceeds the approved ${kind} file-size limit. Choose a smaller file; your current project is unchanged.`;
  }
  if (Number.isFinite(limits.maxTotalProjectBytes)
    && limits.maxTotalProjectBytes !== null
    && currentProjectMediaBytes + file.size > limits.maxTotalProjectBytes) {
    return `"${file.name}" would exceed the approved total project-media limit. Remove media or choose a smaller file; your current project is unchanged.`;
  }
  return null;
}

export function validateDurationAgainstApprovedLimits(durationSeconds, limits) {
  if (limits.status !== 'APPROVED') return null;
  if (limits.minimumExportDurationSeconds !== null
    && durationSeconds < limits.minimumExportDurationSeconds) {
    return `Export duration is below the approved minimum of ${limits.minimumExportDurationSeconds} seconds.`;
  }
  if (limits.maximumExportDurationSeconds !== null
    && durationSeconds > limits.maximumExportDurationSeconds) {
    return `Export duration exceeds the approved maximum of ${limits.maximumExportDurationSeconds} seconds.`;
  }
  return null;
}

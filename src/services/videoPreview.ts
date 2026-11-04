const previewSeekTolerance = 0.4;

export function shouldSeekPreviewVideo(
  currentTime: number,
  targetTime: number,
  forceSeek = false,
): boolean {
  return forceSeek || Math.abs(currentTime - targetTime) > previewSeekTolerance;
}

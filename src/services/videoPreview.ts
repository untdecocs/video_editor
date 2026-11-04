const previewSeekTolerance = 0.4;

export type PreviewVideoStatus = 'loading' | 'ready' | 'unavailable' | 'decode-error' | 'playback-blocked';

export function shouldSeekPreviewVideo(
  currentTime: number,
  targetTime: number,
  forceSeek = false,
): boolean {
  return forceSeek || Math.abs(currentTime - targetTime) > previewSeekTolerance;
}

export function getPreviewVideoFailureStatus(errorCode: number | null): PreviewVideoStatus {
  return errorCode === 3 ? 'decode-error' : 'unavailable';
}

export function getPreviewPlaybackRejectionStatus(errorName: string): PreviewVideoStatus | null {
  if (errorName === 'AbortError') return null;
  return errorName === 'NotAllowedError' ? 'playback-blocked' : 'unavailable';
}

export function getPreviewVideoStatusMessage(status: PreviewVideoStatus): string | null {
  switch (status) {
    case 'loading':
      return 'Loading video preview…';
    case 'unavailable':
      return 'This video is unavailable or could not be loaded.';
    case 'decode-error':
      return 'This video could not be decoded.';
    case 'playback-blocked':
      return 'Browser playback was blocked. Pause and resume the preview to retry this video.';
    case 'ready':
      return null;
  }
}

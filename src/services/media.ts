export const audioFormats = ['MP3', 'WAV', 'AAC', 'M4A', 'FLAC', 'OGG', 'WMA'];
export const imageFormats = ['JPG', 'JPEG', 'PNG', 'WEBP', 'BMP'];
export const exportFormats = ['MP4', 'WebM'];
export const resolutionOptions = [
  '1920x1080',
  '1280x720',
  '1080x1920',
  '1080x1080',
  'Original',
];
export const frameRateOptions = ['24', '30', '60'];

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function buildOutputFileName(audioName: string, extension = 'mp4', suffix = ''): string {
  const sanitizedBase = (audioName || 'video')
    .replace(/\.[^/.]+$/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  const sanitizedSuffix = suffix.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${sanitizedBase || 'video'}${sanitizedSuffix ? `-${sanitizedSuffix}` : ''}-${Date.now()}.${extension}`;
}

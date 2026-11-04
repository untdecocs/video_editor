export const audioFormats = ['MP3', 'WAV', 'AAC', 'M4A', 'FLAC', 'OGG', 'WMA'];
export const imageFormats = ['JPG', 'JPEG', 'PNG', 'WEBP', 'BMP'];
export const videoFormats = ['MP4', 'MOV', 'WEBM', 'M4V'];
export const visualFormats = [...imageFormats, ...videoFormats];
export const exportFormats = ['MP4', 'WebM'];
export const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma'] as const;
export const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'bmp'] as const;
export const videoExtensions = ['mp4', 'mov', 'webm', 'm4v'] as const;
export const visualExtensions = [...imageExtensions, ...videoExtensions] as const;
export const resolutionOptions = [
  '1920x1080',
  '1280x720',
  '1080x1920',
  '1080x1080',
  'Original',
];
export const frameRateOptions = ['24', '30', '60'];

export type MediaImportKind = 'audio' | 'visual';
export type VisualMediaKind = 'image' | 'video';

export type MediaImportValidation =
  | { valid: true; visualKind?: VisualMediaKind }
  | { valid: false; message: string };

type MediaFileDetails = Pick<File, 'name' | 'size'> & Pick<File, 'type'>;

const imageExtensionSet = new Set<string>(imageExtensions);
const audioExtensionSet = new Set<string>(audioExtensions);
const visualExtensionSet = new Set<string>(visualExtensions);
const mimeHintsByExtension: Record<string, readonly string[]> = {
  mp3: ['audio/mpeg', 'audio/mp3', 'audio/x-mp3'],
  wav: ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave'],
  aac: ['audio/aac', 'audio/aacp', 'audio/x-aac'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  flac: ['audio/flac', 'audio/x-flac'],
  ogg: ['audio/ogg', 'audio/vorbis', 'application/ogg'],
  wma: ['audio/x-ms-wma', 'audio/wma'],
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  bmp: ['image/bmp', 'image/x-ms-bmp'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  webm: ['video/webm'],
  m4v: ['video/mp4', 'video/x-m4v'],
};

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 && lastDot < fileName.length - 1
    ? fileName.slice(lastDot + 1).toLowerCase()
    : '';
}

function supportedExtensionsLabel(kind: MediaImportKind): string {
  const extensions = kind === 'audio' ? audioExtensions : visualExtensions;
  return extensions.map((extension) => `.${extension}`).join(', ');
}

/** Validate import eligibility from the filename and MIME hints, not codec decodability. */
export function validateMediaImport(file: MediaFileDetails, kind: MediaImportKind): MediaImportValidation {
  const name = file.name.trim();
  if (!name) {
    return { valid: false, message: 'This file has no name. Choose a named media file and try again.' };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, message: `"${name}" is empty. Choose a non-empty media file and try again.` };
  }

  const extension = getExtension(name);
  const expectedExtensions = kind === 'audio' ? audioExtensionSet : visualExtensionSet;
  if (!expectedExtensions.has(extension)) {
    return {
      valid: false,
      message: `"${name}" has an unsupported ${kind} file extension. Supported extensions: ${supportedExtensionsLabel(kind)}.`,
    };
  }

  const mimeType = (file.type ?? '').trim().toLowerCase().split(';', 1)[0].trim();
  const expectedMimeFamily = kind === 'audio'
    ? 'audio/'
    : imageExtensionSet.has(extension) ? 'image/' : 'video/';
  const expectedMimeHints = mimeHintsByExtension[extension];
  const isGenericMimeHint = ['application/octet-stream', 'application/x-octet-stream', 'binary/octet-stream'].includes(mimeType);
  if (mimeType && !isGenericMimeHint && !expectedMimeHints.includes(mimeType)) {
    return {
      valid: false,
      message: `"${name}" has a MIME type that conflicts with its ${kind} extension. Choose a matching file and try again.`,
    };
  }

  return {
    valid: true,
    ...(kind === 'visual' ? { visualKind: expectedMimeFamily === 'image/' ? 'image' as const : 'video' as const } : {}),
  };
}

export function getSupportedFormatsLabel(kind: MediaImportKind): string {
  return supportedExtensionsLabel(kind);
}

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

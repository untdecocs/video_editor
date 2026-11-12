import {
  DEFAULT_TRACK_ID,
  MAX_TIMELINE_MARKER_LABEL_LENGTH,
  MAX_TIMELINE_MARKER_TIME,
  MAX_TIMELINE_DURATION,
  MIN_STILL_DURATION,
  defaultVideoTrack,
  type TimelineClip,
  type TimelineMarker,
  type TimelineTrack,
  type VisualTransform,
  type AudioClip,
  type AudioTrack,
} from './timeline.ts';
import { TITLE_FONT_FAMILIES, type TitleAlignment, type TitleOverlay } from './titleOverlay.ts';

/**
 * JSON-safe metadata for a visual TimelineAsset. The File and object URL stay
 * in the runtime-only TimelineAsset and are deliberately absent here.
 */
export type ProjectVisualAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video';
  duration: number;
};

/** JSON-safe metadata for an audio source file used by one or more clips. */
export type ProjectAudioAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
};

export type ProjectOutputSettings = {
  presetId: string;
  customWidth: number;
  customHeight: number;
  frameRate: number;
  format: 'MP4' | 'WebM';
};

/**
 * Version 6 of the storage-agnostic project document.
 * TimelineClip and VisualTransform are the same edit values used at runtime.
 */
export type ProjectDocument = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 6;
  audioAssets: ProjectAudioAsset[];
  audioTracks: AudioTrack[];
  audioClips: AudioClip[];
  assets: ProjectVisualAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  titleOverlays: TitleOverlay[];
  markers: TimelineMarker[];
  outputSettings: ProjectOutputSettings;
};

export class ProjectDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectDocumentError';
  }
}

type RecordValue = Record<string, unknown>;

function fail(path: string, reason: string): never {
  throw new ProjectDocumentError(`Invalid project document at ${path}: ${reason}`);
}

function recordAt(value: unknown, path: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'expected a plain JSON object');
  }
  return value as RecordValue;
}

function exactKeys(record: RecordValue, path: string, expected: readonly string[]): void {
  const ownKeys = Reflect.ownKeys(record);
  const unexpected = ownKeys.find((key) => typeof key !== 'string' || !expected.includes(key));
  if (unexpected !== undefined) {
    return fail(path, `unexpected field ${String(unexpected)}; only JSON project fields are allowed`);
  }
  const missing = expected.find((key) => !Object.prototype.hasOwnProperty.call(record, key));
  if (missing) return fail(`${path}.${missing}`, 'required field is missing');
}

function stringAt(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    return fail(path, allowEmpty ? 'expected a string' : 'expected a non-empty string');
  }
  if (value.trim().toLowerCase().startsWith('blob:')) {
    return fail(path, 'object URLs are not permitted in project data');
  }
  return value;
}

function numberAt(
  value: unknown,
  path: string,
  options: { minimum?: number; integer?: boolean } = {},
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || (options.minimum !== undefined && value < options.minimum)
    || (options.integer && !Number.isSafeInteger(value))
  ) {
    const constraints = [
      'expected a finite number',
      options.minimum !== undefined ? ` >= ${options.minimum}` : '',
      options.integer ? ' and a safe integer' : '',
    ].join('');
    return fail(path, constraints);
  }
  return value;
}

function timestampAt(value: unknown, path: string): string {
  const timestamp = stringAt(value, path);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    return fail(path, 'expected a canonical ISO 8601 timestamp');
  }
  return timestamp;
}

function validateAudio(value: unknown): ProjectAudioAsset | null {
  if (value === null) return null;
  const path = 'audio';
  const audio = recordAt(value, path);
  exactKeys(audio, path, ['id', 'fileName', 'mimeType', 'size', 'duration']);
  return {
    id: stringAt(audio.id, `${path}.id`),
    fileName: stringAt(audio.fileName, `${path}.fileName`),
    mimeType: stringAt(audio.mimeType, `${path}.mimeType`, true),
    size: numberAt(audio.size, `${path}.size`, { minimum: 0, integer: true }),
    // The existing app preserves an audio file even when metadata duration
    // could not be read, represented by 0.
    duration: numberAt(audio.duration, `${path}.duration`, { minimum: 0 }),
  };
}

function validateAsset(value: unknown, index: number): ProjectVisualAsset {
  const path = `assets[${index}]`;
  const asset = recordAt(value, path);
  exactKeys(asset, path, ['id', 'fileName', 'mimeType', 'size', 'kind', 'duration']);

  if (asset.kind !== 'image' && asset.kind !== 'video') {
    return fail(`${path}.kind`, 'expected "image" or "video"');
  }
  return {
    id: stringAt(asset.id, `${path}.id`),
    fileName: stringAt(asset.fileName, `${path}.fileName`),
    mimeType: stringAt(asset.mimeType, `${path}.mimeType`, true),
    size: numberAt(asset.size, `${path}.size`, { minimum: 0, integer: true }),
    kind: asset.kind,
    duration: numberAt(asset.duration, `${path}.duration`, { minimum: 0 }),
  };
}

function validateTransform(value: unknown, path: string): VisualTransform {
  const transform = recordAt(value, path);
  exactKeys(transform, path, ['fit', 'zoom', 'x', 'y', 'rotation', 'flipX', 'flipY']);
  if (transform.fit !== 'cover' && transform.fit !== 'contain') {
    return fail(`${path}.fit`, 'expected "cover" or "contain"');
  }
  if (typeof transform.flipX !== 'boolean') return fail(`${path}.flipX`, 'expected a boolean');
  if (typeof transform.flipY !== 'boolean') return fail(`${path}.flipY`, 'expected a boolean');
  return {
    fit: transform.fit,
    zoom: numberAt(transform.zoom, `${path}.zoom`, { minimum: Number.MIN_VALUE }),
    x: numberAt(transform.x, `${path}.x`),
    y: numberAt(transform.y, `${path}.y`),
    rotation: numberAt(transform.rotation, `${path}.rotation`),
    flipX: transform.flipX,
    flipY: transform.flipY,
  };
}

function validateClip(value: unknown, index: number, version: 1 | 2 | 3 | 4 | 5 | 6): TimelineClip {
  const path = `clips[${index}]`;
  const clip = recordAt(value, path);
  exactKeys(clip, path, version === 1
    ? ['id', 'assetId', 'start', 'end', 'stillDuration', 'transition', 'transform']
    : version >= 5
      ? ['id', 'assetId', 'trackId', 'timelinePosition', 'start', 'end', 'stillDuration', 'stillDurationMode', 'transition', 'transform']
      : ['id', 'assetId', 'trackId', 'timelinePosition', 'start', 'end', 'stillDuration', 'transition', 'transform']);
  if (clip.transition !== 'none' && clip.transition !== 'fade') {
    return fail(`${path}.transition`, 'expected "none" or "fade"');
  }
  const start = numberAt(clip.start, `${path}.start`, { minimum: 0 });
  const end = numberAt(clip.end, `${path}.end`, { minimum: 0 });
  if (end < start) return fail(`${path}.end`, 'must be greater than or equal to start');
  if (version >= 5 && clip.stillDurationMode !== 'custom' && clip.stillDurationMode !== 'match-audio'
    && !(version >= 6 && clip.stillDurationMode === 'match-video')) {
    return fail(`${path}.stillDurationMode`, 'expected "custom", "match-audio", or "match-video"');
  }
  return {
    id: stringAt(clip.id, `${path}.id`),
    assetId: stringAt(clip.assetId, `${path}.assetId`),
    trackId: version >= 2 ? stringAt(clip.trackId, `${path}.trackId`) : DEFAULT_TRACK_ID,
    timelinePosition: version >= 2
      ? numberAt(clip.timelinePosition, `${path}.timelinePosition`, { minimum: 0 })
      : 0,
    start,
    end,
    stillDuration: numberAt(clip.stillDuration, `${path}.stillDuration`, { minimum: Number.MIN_VALUE }),
    stillDurationMode: version >= 5
      ? clip.stillDurationMode as TimelineClip['stillDurationMode']
      : 'custom',
    transition: clip.transition,
    transform: validateTransform(clip.transform, `${path}.transform`),
  };
}

function validateTimelineMarker(value: unknown, index: number): TimelineMarker {
  const path = `markers[${index}]`;
  const marker = recordAt(value, path);
  exactKeys(marker, path, ['id', 'time', 'label']);
  const id = stringAt(marker.id, `${path}.id`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) {
    return fail(`${path}.id`, 'must be 1–128 alphanumeric, period, underscore, colon, or hyphen characters');
  }
  const time = numberAt(marker.time, `${path}.time`, { minimum: 0 });
  if (time > MAX_TIMELINE_MARKER_TIME) {
    return fail(`${path}.time`, 'must remain within 24 hours');
  }
  const label = stringAt(marker.label, `${path}.label`);
  if (label.length > MAX_TIMELINE_MARKER_LABEL_LENGTH) {
    return fail(`${path}.label`, `must be at most ${MAX_TIMELINE_MARKER_LABEL_LENGTH} characters`);
  }
  if (/[\u0000-\u001F\u007F]/.test(label)) {
    return fail(`${path}.label`, 'contains unsupported control characters');
  }
  return { id, time, label };
}

function validateTitleOverlay(value: unknown, index: number): TitleOverlay {
  const path = `titleOverlays[${index}]`;
  const title = recordAt(value, path);
  exactKeys(title, path, [
    'id', 'text', 'start', 'duration', 'x', 'y', 'fontSize', 'fontWeight',
    'fontFamily', 'color', 'align', 'background', 'shadow',
  ]);
  const id = stringAt(title.id, `${path}.id`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) {
    return fail(`${path}.id`, 'must be 1–128 alphanumeric, period, underscore, colon, or hyphen characters');
  }
  const text = stringAt(title.text, `${path}.text`);
  if (text.length > 500) return fail(`${path}.text`, 'must be at most 500 characters');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    return fail(`${path}.text`, 'contains unsupported control characters');
  }
  const start = numberAt(title.start, `${path}.start`, { minimum: 0 });
  const duration = numberAt(title.duration, `${path}.duration`, { minimum: 0.1 });
  if (start > 86_400 || duration > 86_400 || start + duration > 86_400) {
    return fail(path, 'title timing must remain within 24 hours');
  }
  const x = numberAt(title.x, `${path}.x`, { minimum: 0 });
  const y = numberAt(title.y, `${path}.y`, { minimum: 0 });
  if (x > 100) return fail(`${path}.x`, 'must be between 0 and 100 percent');
  if (y > 100) return fail(`${path}.y`, 'must be between 0 and 100 percent');
  const fontSize = numberAt(title.fontSize, `${path}.fontSize`, { minimum: 2 });
  if (fontSize > 20) return fail(`${path}.fontSize`, 'must be between 2 and 20 percent of output height');
  if (title.fontWeight !== 400 && title.fontWeight !== 700) {
    return fail(`${path}.fontWeight`, 'expected 400 or 700');
  }
  if (!TITLE_FONT_FAMILIES.includes(title.fontFamily as typeof TITLE_FONT_FAMILIES[number])) {
    return fail(`${path}.fontFamily`, 'expected a supported system-safe font family');
  }
  const colorAt = (color: unknown, colorPath: string): string => {
    if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return fail(colorPath, 'expected a six-digit hex color');
    }
    return color.toUpperCase();
  };
  if (title.align !== 'left' && title.align !== 'center' && title.align !== 'right') {
    return fail(`${path}.align`, 'expected "left", "center", or "right"');
  }
  if (title.background !== null && typeof title.background !== 'string') {
    return fail(`${path}.background`, 'expected a six-digit hex color or null');
  }
  if (typeof title.shadow !== 'boolean') return fail(`${path}.shadow`, 'expected a boolean');
  return {
    id,
    text,
    start,
    duration,
    x,
    y,
    fontSize,
    fontWeight: title.fontWeight,
    fontFamily: title.fontFamily as TitleOverlay['fontFamily'],
    color: colorAt(title.color, `${path}.color`),
    align: title.align as TitleAlignment,
    background: title.background === null ? null : colorAt(title.background, `${path}.background`),
    shadow: title.shadow,
  };
}

function validateTrack(value: unknown, index: number): TimelineTrack {
  const path = `tracks[${index}]`;
  const track = recordAt(value, path);
  exactKeys(track, path, ['id', 'name', 'order', 'visible', 'locked']);
  if (typeof track.visible !== 'boolean') return fail(`${path}.visible`, 'expected a boolean');
  if (typeof track.locked !== 'boolean') return fail(`${path}.locked`, 'expected a boolean');
  return {
    id: stringAt(track.id, `${path}.id`),
    name: stringAt(track.name, `${path}.name`),
    order: numberAt(track.order, `${path}.order`, { minimum: 0, integer: true }),
    visible: track.visible,
    locked: track.locked,
  };
}

function validateAudioTrack(value: unknown, index: number): AudioTrack {
  const path = `audioTracks[${index}]`;
  const track = recordAt(value, path);
  exactKeys(track, path, ['id', 'name', 'order', 'visible', 'locked']);
  if (typeof track.visible !== 'boolean') return fail(`${path}.visible`, 'expected a boolean');
  if (typeof track.locked !== 'boolean') return fail(`${path}.locked`, 'expected a boolean');
  return {
    id: stringAt(track.id, `${path}.id`),
    name: stringAt(track.name, `${path}.name`),
    order: numberAt(track.order, `${path}.order`, { minimum: 0, integer: true }),
    visible: track.visible,
    locked: track.locked,
  };
}

function validateAudioClip(value: unknown, index: number): AudioClip {
  const path = `audioClips[${index}]`;
  const clip = recordAt(value, path);
  exactKeys(clip, path, ['id', 'assetId', 'trackId', 'timelinePosition', 'start', 'end', 'volume']);
  const start = numberAt(clip.start, `${path}.start`, { minimum: 0 });
  const end = numberAt(clip.end, `${path}.end`, { minimum: 0 });
  if (end <= start) return fail(`${path}.end`, 'must be greater than start');
  const volume = numberAt(clip.volume, `${path}.volume`, { minimum: 0 });
  if (volume > 2) return fail(`${path}.volume`, 'must be at most 2');
  return {
    id: stringAt(clip.id, `${path}.id`),
    assetId: stringAt(clip.assetId, `${path}.assetId`),
    trackId: stringAt(clip.trackId, `${path}.trackId`),
    timelinePosition: numberAt(clip.timelinePosition, `${path}.timelinePosition`, { minimum: 0 }),
    start,
    end,
    volume,
  };
}

function validateOutputSettings(value: unknown): ProjectOutputSettings {
  const path = 'outputSettings';
  const settings = recordAt(value, path);
  exactKeys(settings, path, ['presetId', 'customWidth', 'customHeight', 'frameRate', 'format']);
  const presetId = stringAt(settings.presetId, `${path}.presetId`);
  const frameRate = numberAt(settings.frameRate, `${path}.frameRate`);
  if (![24, 30, 60].includes(frameRate)) {
    return fail(`${path}.frameRate`, 'expected 24, 30, or 60');
  }
  if (settings.format !== 'MP4' && settings.format !== 'WebM') {
    return fail(`${path}.format`, 'expected "MP4" or "WebM"');
  }
  return {
    presetId,
    customWidth: numberAt(settings.customWidth, `${path}.customWidth`, { minimum: 1, integer: true }),
    customHeight: numberAt(settings.customHeight, `${path}.customHeight`, { minimum: 1, integer: true }),
    frameRate,
    format: settings.format,
  };
}

/**
 * Validates untrusted document data and returns a fresh object containing only
 * the schema's explicit fields. Unknown keys (including File/url properties)
 * are rejected rather than being silently serialized.
 */
export function validateProjectDocument(value: unknown): ProjectDocument {
  const path = 'project';
  const project = recordAt(value, path);
  const version = project.schemaVersion;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6) {
    return fail('schemaVersion', `unsupported schema version ${String(version)} (supported: 1, 2, 3, 4, 5, 6)`);
  }
  exactKeys(project, path, version === 1 ? [
    'id',
    'name',
    'createdAt',
    'updatedAt',
    'schemaVersion',
    'audio',
    'assets',
    'clips',
    'outputSettings',
  ] : version === 2 ? [
    'id',
    'name',
    'createdAt',
    'updatedAt',
    'schemaVersion',
    'audio',
    'assets',
    'tracks',
    'clips',
    'outputSettings',
  ] : version === 3 ? [
    'id',
    'name',
    'createdAt',
    'updatedAt',
    'schemaVersion',
    'audio',
    'assets',
    'tracks',
    'clips',
    'outputSettings',
    'titleOverlays',
  ] : version === 4 ? [
    'id',
    'name',
    'createdAt',
    'updatedAt',
    'schemaVersion',
    'audio',
    'assets',
    'tracks',
    'clips',
    'outputSettings',
    'titleOverlays',
    'markers',
  ] : version === 6 ? [
    'id',
    'name',
    'createdAt',
    'updatedAt',
    'schemaVersion',
    'audioAssets',
    'audioTracks',
    'audioClips',
    'assets',
    'tracks',
    'clips',
    'titleOverlays',
    'markers',
    'outputSettings',
  ] : [
    'id',
    'name',
    'createdAt',
    'updatedAt',
    'schemaVersion',
    'audio',
    'assets',
    'tracks',
    'clips',
    'outputSettings',
    'titleOverlays',
    'markers',
  ]);
  if (!Array.isArray(project.assets)) return fail('assets', 'expected an array');
  if (!Array.isArray(project.clips)) return fail('clips', 'expected an array');
  if (version >= 2 && !Array.isArray(project.tracks)) return fail('tracks', 'expected an array');
  if (version >= 3 && !Array.isArray(project.titleOverlays)) return fail('titleOverlays', 'expected an array');
  if (version >= 4 && !Array.isArray(project.markers)) return fail('markers', 'expected an array');
  if (version === 6 && (!Array.isArray(project.audioAssets) || !Array.isArray(project.audioTracks) || !Array.isArray(project.audioClips))) {
    return fail('audioAssets/audioTracks/audioClips', 'expected arrays');
  }

  const projectId = stringAt(project.id, 'project.id');
  const name = stringAt(project.name, 'project.name');
  const createdAt = timestampAt(project.createdAt, 'project.createdAt');
  const updatedAt = timestampAt(project.updatedAt, 'project.updatedAt');
  const assets = project.assets.map(validateAsset);
  let clips = project.clips.map((clip, index) => validateClip(clip, index, version));
  const tracks = version === 1
    ? [defaultVideoTrack()]
    : (project.tracks as unknown[]).map(validateTrack);
  if (version === 1) {
    let timelinePosition = 0;
    clips = clips.map((clip) => {
      const positioned = { ...clip, trackId: DEFAULT_TRACK_ID, timelinePosition };
      timelinePosition += Math.max(0, clip.end - clip.start) || clip.stillDuration;
      return positioned;
    });
  }
  const legacyAudio = version < 6 ? validateAudio(project.audio) : null;
  const audioAssets = version === 6
    ? (project.audioAssets as unknown[]).map((asset, index) => {
      const path = `audioAssets[${index}]`;
      const record = recordAt(asset, path);
      exactKeys(record, path, ['id', 'fileName', 'mimeType', 'size', 'duration']);
      return {
        id: stringAt(record.id, `${path}.id`),
        fileName: stringAt(record.fileName, `${path}.fileName`),
        mimeType: stringAt(record.mimeType, `${path}.mimeType`, true),
        size: numberAt(record.size, `${path}.size`, { minimum: 0, integer: true }),
        duration: numberAt(record.duration, `${path}.duration`, { minimum: 0 }),
      };
    })
    : legacyAudio ? [legacyAudio] : [];
  const audioTracks = version === 6
    ? (project.audioTracks as unknown[]).map(validateAudioTrack)
    : legacyAudio && legacyAudio.duration > 0 ? [{
      id: `${legacyAudio.id}-track`,
      name: 'Audio 1',
      order: 0,
      visible: true,
      locked: false,
    }] : [];
  const audioClips = version === 6
    ? (project.audioClips as unknown[]).map(validateAudioClip)
    : legacyAudio && legacyAudio.duration > 0 ? [{
      id: `${legacyAudio.id}-clip`,
      assetId: legacyAudio.id,
      trackId: `${legacyAudio.id}-track`,
      timelinePosition: 0,
      start: 0,
      end: legacyAudio.duration,
      volume: 1,
    }] : [];
  const titleOverlays = version >= 3
    ? (project.titleOverlays as unknown[]).map(validateTitleOverlay)
    : [];
  const markers = version >= 4
    ? (project.markers as unknown[]).map(validateTimelineMarker)
    : [];
  const ids = new Set<string>();
  const entityIds = [
    projectId,
    ...audioAssets.map((asset) => asset.id),
    ...assets.map((asset) => asset.id),
    ...tracks.map((track) => track.id),
    ...audioTracks.map((track) => track.id),
    ...clips.map((clip) => clip.id),
    ...audioClips.map((clip) => clip.id),
    ...titleOverlays.map((title) => title.id),
    ...markers.map((marker) => marker.id),
  ];
  for (const id of entityIds) {
    if (ids.has(id)) return fail('ids', `duplicate id "${id}"`);
    ids.add(id);
  }
  const assetIds = new Set(assets.map((asset) => asset.id));
  const trackIds = new Set(tracks.map((track) => track.id));
  if (!tracks.length) return fail('tracks', 'at least one visual track is required');
  for (const [index, track] of tracks.entries()) {
    if (tracks.findIndex((other) => other.order === track.order) !== index) {
      return fail(`tracks[${index}].order`, 'track order values must be unique');
    }
  }
  for (const [index, clip] of clips.entries()) {
    if (!assetIds.has(clip.assetId)) {
      return fail(`clips[${index}].assetId`, `references missing visual asset "${clip.assetId}"`);
    }
    if (!trackIds.has(clip.trackId)) {
      return fail(`clips[${index}].trackId`, `references missing visual track "${clip.trackId}"`);
    }
    const asset = assets.find((item) => item.id === clip.assetId);
    if (version >= 5 && asset?.kind === 'image') {
      if (clip.stillDuration < MIN_STILL_DURATION || clip.stillDuration > MAX_TIMELINE_DURATION) {
        return fail(`clips[${index}].stillDuration`, 'still duration must be between 0.1 seconds and 24 hours');
      }
      if (clip.timelinePosition + clip.stillDuration > MAX_TIMELINE_DURATION) {
        return fail(`clips[${index}]`, 'still timing must remain within 24 hours');
      }
    }
  }
  const audioAssetIds = new Set(audioAssets.map((asset) => asset.id));
  const audioTrackIds = new Set(audioTracks.map((track) => track.id));
  for (const [index, track] of audioTracks.entries()) {
    if (audioTracks.findIndex((other) => other.order === track.order) !== index) {
      return fail(`audioTracks[${index}].order`, 'track order values must be unique');
    }
  }
  for (const [index, clip] of audioClips.entries()) {
    if (!audioAssetIds.has(clip.assetId)) return fail(`audioClips[${index}].assetId`, `references missing audio asset "${clip.assetId}"`);
    if (!audioTrackIds.has(clip.trackId)) return fail(`audioClips[${index}].trackId`, `references missing audio track "${clip.trackId}"`);
    const audioAsset = audioAssets.find((asset) => asset.id === clip.assetId);
    if (audioAsset && clip.end > audioAsset.duration) {
      return fail(`audioClips[${index}].end`, 'must not exceed the source audio duration');
    }
    if (clip.timelinePosition + clip.end - clip.start > MAX_TIMELINE_DURATION) {
      return fail(`audioClips[${index}]`, 'audio timing must remain within 24 hours');
    }
  }

  return {
    id: projectId,
    name,
    createdAt,
    updatedAt,
    schemaVersion: 6,
    audioAssets,
    audioTracks,
    audioClips,
    assets,
    tracks,
    clips,
    titleOverlays,
    markers,
    outputSettings: validateOutputSettings(project.outputSettings),
  };
}

/** Serialize only schema-validated fields to JSON; no runtime media values are included. */
export function serializeProject(document: ProjectDocument): string {
  return JSON.stringify(validateProjectDocument(document));
}

/** Parse and validate a JSON project document with actionable error messages. */
export function parseProject(json: string): ProjectDocument {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ProjectDocumentError(`Invalid project JSON: ${detail}`);
  }
  return validateProjectDocument(value);
}

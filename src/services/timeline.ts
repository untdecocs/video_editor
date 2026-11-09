import { PORTABLE_PACKAGE_SAFETY_LIMITS } from './mediaSafetyLimits.js';

export type PlatformPreset = {
  id: string;
  platform: string;
  placement: string;
  width: number;
  height: number;
};

export type VisualTransform = {
  fit: 'cover' | 'contain';
  zoom: number;
  x: number;
  y: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
};

export type TimelineAsset = {
  id: string;
  file: File;
  url: string;
  kind: 'image' | 'video';
  duration: number;
};

export type TimelineTrack = {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  locked: boolean;
};

export type TimelineClip = {
  id: string;
  assetId: string;
  trackId: string;
  /** Absolute position on the timeline; start/end remain source in/out points. */
  timelinePosition: number;
  start: number;
  end: number;
  stillDuration: number;
  stillDurationMode: 'custom' | 'match-audio';
  transition: 'none' | 'fade';
  transform: VisualTransform;
};

export type TimelineMarker = {
  id: string;
  time: number;
  label: string;
};

export const MAX_TIMELINE_MARKER_TIME = PORTABLE_PACKAGE_SAFETY_LIMITS.maxTimelineDurationSeconds;
export const MAX_TIMELINE_DURATION = PORTABLE_PACKAGE_SAFETY_LIMITS.maxTimelineDurationSeconds;
export const MIN_STILL_DURATION = 0.1;
export const MAX_TIMELINE_MARKER_LABEL_LENGTH = 80;

export type StillDurationMode = TimelineClip['stillDurationMode'];

/** Duration available to a still at a timeline position, with a usable 0.1s minimum. */
export function getStillDurationLimit(timelinePosition: number): number {
  const position = Number.isFinite(timelinePosition) ? Math.max(0, timelinePosition) : 0;
  return Math.max(MIN_STILL_DURATION, MAX_TIMELINE_DURATION - position);
}

export function normalizeStillDuration(duration: number, timelinePosition: number): number {
  const limit = getStillDurationLimit(timelinePosition);
  const safeDuration = Number.isFinite(duration) ? duration : MIN_STILL_DURATION;
  return Math.min(limit, Math.max(MIN_STILL_DURATION, safeDuration));
}

/** Match mode stores its latest usable resolved duration in stillDuration. */
export function setStillDurationMode(
  clip: TimelineClip,
  mode: StillDurationMode,
  audioDuration: number,
): TimelineClip {
  if (mode === 'match-audio' && Number.isFinite(audioDuration) && audioDuration > 0) {
    return {
      ...clip,
      stillDurationMode: mode,
      stillDuration: normalizeStillDuration(audioDuration, clip.timelinePosition),
    };
  }
  return { ...clip, stillDurationMode: mode };
}

/** Refresh matched stills after an audio duration is decoded or replaced. */
export function updateMatchedStillDurations(
  clips: TimelineClip[],
  audioDuration: number,
): TimelineClip[] {
  if (!Number.isFinite(audioDuration) || audioDuration <= 0) return clips;
  let changed = false;
  const next = clips.map((clip) => {
    if (clip.end > clip.start || clip.stillDurationMode !== 'match-audio') return clip;
    const stillDuration = normalizeStillDuration(audioDuration, clip.timelinePosition);
    if (stillDuration === clip.stillDuration) return clip;
    changed = true;
    return { ...clip, stillDuration };
  });
  return changed ? next : clips;
}

export function createTimelineMarker(
  markers: TimelineMarker[],
  time: number,
  idFactory: () => string = () => globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): TimelineMarker {
  return {
    id: idFactory(),
    time: Math.min(MAX_TIMELINE_MARKER_TIME, Math.max(0, Number.isFinite(time) ? time : 0)),
    label: `Marker ${markers.length + 1}`,
  };
}

export const defaultTransform: VisualTransform = {
  fit: 'cover',
  zoom: 1,
  x: 0,
  y: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
};

export const DEFAULT_TRACK_ID = 'track-video-1';
export const defaultVideoTrack = (): TimelineTrack => ({
  id: DEFAULT_TRACK_ID,
  name: 'Video 1',
  order: 0,
  visible: true,
  locked: false,
});

export const platformPresets: PlatformPreset[] = [
  { id: 'youtube', platform: 'YouTube', placement: 'Landscape video', width: 1920, height: 1080 },
  { id: 'instagram', platform: 'Instagram', placement: 'Reels', width: 1080, height: 1920 },
  { id: 'tiktok', platform: 'TikTok', placement: 'Video', width: 1080, height: 1920 },
  { id: 'x', platform: 'X (Twitter)', placement: 'Landscape video', width: 1920, height: 1080 },
  { id: 'linkedin', platform: 'LinkedIn', placement: 'Landscape video', width: 1920, height: 1080 },
  { id: 'pinterest', platform: 'Pinterest', placement: 'Standard video pin', width: 1000, height: 1500 },
  { id: 'facebook', platform: 'Facebook', placement: 'Reels', width: 1080, height: 1920 },
  { id: 'snapchat', platform: 'Snapchat', placement: 'Spotlight', width: 1080, height: 1920 },
  { id: 'custom', platform: 'Custom', placement: 'Set dimensions', width: 1920, height: 1080 },
];

export function formatAspectRatio(width: number, height: number): string {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return `${width}:${height}`;
  }
  const greatestCommonDivisor = (a: number, b: number): number => b === 0 ? a : greatestCommonDivisor(b, a % b);
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}`;
}

export function getClipDuration(clip: TimelineClip): number {
  return Math.max(0, clip.end - clip.start) || Math.max(0.1, clip.stillDuration);
}

export function getTimelineDuration(clips: TimelineClip[]): number {
  return clips.reduce((duration, clip) => Math.max(duration, clip.timelinePosition + getClipDuration(clip)), 0);
}

export function clampTimelineTime(time: number, duration: number): number {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safeTime = Number.isFinite(time) ? time : 0;
  return Math.min(Math.max(0, safeTime), safeDuration);
}

/** Clamp a clip position to zero and, when enabled, round it to a fixed timeline increment. */
export function snapTimelinePosition(
  position: number,
  enabled: boolean,
  increment = 0.1,
): number {
  const nonNegativePosition = Number.isFinite(position) ? Math.max(0, position) : 0;
  if (!enabled) return nonNegativePosition;
  const safeIncrement = Number.isFinite(increment) && increment > 0 ? increment : 0.1;
  return Math.max(0, Number((Math.round(nonNegativePosition / safeIncrement) * safeIncrement).toFixed(10)));
}

/** Convert a pointer drop into an absolute clip start while preserving the original grab offset. */
export function getTimelinePositionFromDrop(
  pointerX: number,
  timelineLeft: number,
  pixelsPerSecond: number,
  grabOffsetPixels: number,
  snapEnabled: boolean,
): number {
  if (!Number.isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) return 0;
  const pointerPosition = (pointerX - timelineLeft - grabOffsetPixels) / pixelsPerSecond;
  return snapTimelinePosition(pointerPosition, snapEnabled);
}

function createClipId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Duplicate a clip directly after its source clip without changing its source range or effects. */
export function duplicateTimelineClip(
  clips: TimelineClip[],
  clipId: string,
  createId: () => string = createClipId,
): TimelineClip[] {
  const source = clips.find((clip) => clip.id === clipId);
  if (!source) return clips;
  const ids = new Set(clips.map((clip) => clip.id));
  let id = createId();
  while (ids.has(id)) id = createId();
  const isStill = source.end <= source.start;
  const timelinePosition = Math.min(
    source.timelinePosition + getClipDuration(source),
    MAX_TIMELINE_DURATION - (isStill ? MIN_STILL_DURATION : 0),
  );
  const duplicate = {
    ...source,
    id,
    timelinePosition,
    ...(isStill ? { stillDuration: normalizeStillDuration(source.stillDuration, timelinePosition) } : {}),
    transform: { ...source.transform },
  };
  const sourceIndex = clips.indexOf(source);
  return [...clips.slice(0, sourceIndex + 1), duplicate, ...clips.slice(sourceIndex + 1)];
}

export function getActiveClips(
  tracks: TimelineTrack[],
  clips: TimelineClip[],
  time: number,
): Array<{ clip: TimelineClip; elapsed: number }> {
  const visibleTracks = new Set(tracks.filter((track) => track.visible).map((track) => track.id));
  const rank = new Map([...tracks].sort((a, b) => a.order - b.order).map((track, index) => [track.id, index]));
  return clips
    .filter((clip) => visibleTracks.has(clip.trackId)
      && time >= clip.timelinePosition
      && time < clip.timelinePosition + getClipDuration(clip))
    .sort((a, b) => (rank.get(a.trackId) ?? -1) - (rank.get(b.trackId) ?? -1)
      || a.timelinePosition - b.timelinePosition
      || a.id.localeCompare(b.id))
    .map((clip) => ({ clip, elapsed: time - clip.timelinePosition }));
}

export function getPreviousClipOnTrack(
  clips: TimelineClip[],
  trackId: string,
  beforePosition: number,
): TimelineClip | null {
  return clips
    .filter((clip) => clip.trackId === trackId
      && clip.timelinePosition + getClipDuration(clip) <= beforePosition)
    .sort((a, b) => b.timelinePosition - a.timelinePosition || b.id.localeCompare(a.id))[0] ?? null;
}

export function locateClipAtTime(clips: TimelineClip[], time: number): { clip: TimelineClip; elapsed: number } | null {
  const clip = clips.find((item) => time >= item.timelinePosition
    && time < item.timelinePosition + getClipDuration(item));
  return clip ? { clip, elapsed: time - clip.timelinePosition } : null;
}

export function getClipSourceTime(clip: TimelineClip, timelineTime: number): number {
  const elapsed = Math.max(0, Math.min(getClipDuration(clip), timelineTime - clip.timelinePosition));
  return clip.start + elapsed;
}

export function moveClip(clips: TimelineClip[], fromIndex: number, toIndex: number): TimelineClip[] {
  if (fromIndex < 0 || fromIndex >= clips.length || toIndex < 0 || toIndex >= clips.length) {
    return clips;
  }
  const next = [...clips];
  const [clip] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, clip);
  return next;
}

export function splitClip(clips: TimelineClip[], clipId: string, splitAt: number): TimelineClip[] {
  const index = clips.findIndex((clip) => clip.id === clipId);
  const clip = clips[index];
  if (!clip || splitAt <= clip.start || splitAt >= clip.end) {
    return clips;
  }
  const first = { ...clip, end: splitAt };
  const second = {
    ...clip,
    id: globalThis.crypto?.randomUUID?.() ?? `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timelinePosition: clip.timelinePosition + (splitAt - clip.start),
    start: splitAt,
  };
  return [...clips.slice(0, index), first, second, ...clips.slice(index + 1)];
}

export function splitClipAtTimelineTime(clips: TimelineClip[], clipId: string, time: number): TimelineClip[] {
  const clip = clips.find((item) => item.id === clipId);
  if (!clip || time <= clip.timelinePosition || time >= clip.timelinePosition + getClipDuration(clip)) return clips;
  if (clip.end > clip.start) {
    return splitClip(clips, clipId, clip.start + (time - clip.timelinePosition));
  }
  const firstDuration = time - clip.timelinePosition;
  const secondDuration = clip.stillDuration - firstDuration;
  if (firstDuration <= 0 || secondDuration <= 0) return clips;
  const index = clips.indexOf(clip);
  const stillDurationMode = clip.stillDurationMode === 'match-audio' ? 'custom' : clip.stillDurationMode;
  const first = { ...clip, stillDuration: firstDuration, stillDurationMode };
  const second = {
    ...clip,
    id: globalThis.crypto?.randomUUID?.() ?? `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timelinePosition: time,
    stillDuration: secondDuration,
    stillDurationMode,
  };
  return [...clips.slice(0, index), first, second, ...clips.slice(index + 1)];
}

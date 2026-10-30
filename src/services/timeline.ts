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

export type TimelineClip = {
  id: string;
  assetId: string;
  start: number;
  end: number;
  stillDuration: number;
  transition: 'none' | 'fade';
  transform: VisualTransform;
};

export const defaultTransform: VisualTransform = {
  fit: 'cover',
  zoom: 1,
  x: 0,
  y: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
};

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

export function getClipDuration(clip: TimelineClip): number {
  return Math.max(0, clip.end - clip.start) || Math.max(0.1, clip.stillDuration);
}

export function getTimelineDuration(clips: TimelineClip[]): number {
  return clips.reduce((duration, clip) => duration + getClipDuration(clip), 0);
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
    start: splitAt,
  };
  return [...clips.slice(0, index), first, second, ...clips.slice(index + 1)];
}
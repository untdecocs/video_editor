import { useEffect, useRef } from 'react';
import type { AudioAsset, AudioClip, AudioTrack } from '../services/timeline';
import { getAudioClipDuration } from '../services/timeline';

type Props = {
  assets: AudioAsset[];
  tracks: AudioTrack[];
  clips: AudioClip[];
  currentTime: number;
  isPlaying: boolean;
  seekRevision: number;
  volume: number;
  onPlaybackError: (message: string) => void;
};

export function AudioTimelinePlayback({
  assets,
  tracks,
  clips,
  currentTime,
  isPlaying,
  seekRevision,
  volume,
  onPlaybackError,
}: Props) {
  const elements = useRef(new Map<string, HTMLAudioElement>());
  const reportedErrors = useRef(new Set<string>());
  const previousSeekRevision = useRef(seekRevision);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const visibleTracks = new Set(tracks.filter((track) => track.visible).map((track) => track.id));

  useEffect(() => {
    const activeClipIds = new Set<string>();
    for (const clip of clips) {
      const element = elements.current.get(clip.id);
      const asset = assetById.get(clip.assetId);
      if (!element || !asset) continue;
      const isActive = visibleTracks.has(clip.trackId)
        && currentTime >= clip.timelinePosition
        && currentTime < clip.timelinePosition + getAudioClipDuration(clip);
      if (!isActive) {
        element.pause();
        continue;
      }

      activeClipIds.add(clip.id);
      element.volume = Math.max(0, Math.min(1, volume * clip.volume));
      const sourceTime = clip.start + currentTime - clip.timelinePosition;
      if (element.readyState >= HTMLMediaElement.HAVE_METADATA
        && (previousSeekRevision.current !== seekRevision
          || Math.abs(element.currentTime - sourceTime) > 0.25)) {
        try {
          element.currentTime = sourceTime;
        } catch {
          onPlaybackError(`Could not seek audio clip "${asset.file.name}".`);
        }
      }
      if (isPlaying && element.paused) {
        void element.play().catch(() => {
          if (reportedErrors.current.has(clip.id)) return;
          reportedErrors.current.add(clip.id);
          onPlaybackError(`The browser could not play "${asset.file.name}".`);
        });
      } else if (!isPlaying) {
        element.pause();
      }
    }

    elements.current.forEach((element, clipId) => {
      if (!activeClipIds.has(clipId)) element.pause();
    });
    previousSeekRevision.current = seekRevision;
  }, [assets, assetById, clips, currentTime, isPlaying, onPlaybackError, seekRevision, visibleTracks, volume]);

  return (
    <div className="sr-only" aria-hidden="true">
      {clips.map((clip) => {
        const asset = assetById.get(clip.assetId);
        return asset ? (
          <audio
            key={clip.id}
            ref={(element) => {
              if (element) elements.current.set(clip.id, element);
              else elements.current.delete(clip.id);
            }}
            src={asset.url}
            preload="auto"
            onLoadedMetadata={(event) => {
              if (currentTime >= clip.timelinePosition
                && currentTime < clip.timelinePosition + getAudioClipDuration(clip)) {
                event.currentTarget.currentTime = clip.start + currentTime - clip.timelinePosition;
              }
            }}
          />
        ) : null;
      })}
    </div>
  );
}

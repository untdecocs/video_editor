import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultTransform, getActiveClips, getClipSourceTime, type TimelineAsset, type TimelineClip, type TimelineTrack } from '../services/timeline';
import {
  getPreviewPlaybackRejectionStatus,
  getPreviewVideoFailureStatus,
  getPreviewVideoStatusMessage,
  shouldSeekPreviewVideo,
  type PreviewVideoStatus,
} from '../services/videoPreview';
import { getActiveTitles, mapTitleToOutput, type TitleOverlay } from '../services/titleOverlay';

type CompositionPreviewProps = {
  assets: TimelineAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  titles: TitleOverlay[];
  currentTime: number;
  isPlaying: boolean;
  seekRevision: number;
  width: number;
  height: number;
};

export function CompositionPreview({ assets, tracks, clips, titles, currentTime, isPlaying, seekRevision, width, height }: CompositionPreviewProps) {
  const videoElements = useRef(new Map<string, HTMLVideoElement>());
  const previousMappings = useRef(new Map<string, number>());
  const previousSeekRevision = useRef(-1);
  const previousIsPlaying = useRef(false);
  const [videoStatuses, setVideoStatuses] = useState<Record<string, PreviewVideoStatus>>({});
  const active = useMemo(() => getActiveClips(tracks, clips, currentTime)
    .map(({ clip, elapsed }) => ({ clip, elapsed, asset: assets.find((item) => item.id === clip.assetId) }))
    .filter((item) => item.asset), [assets, clips, currentTime, tracks]);
  const activeTitles = useMemo(() => getActiveTitles(titles, currentTime), [titles, currentTime]);
  const videoLayers = useMemo(() => active.filter(({ asset }) => asset?.kind === 'video')
    .map(({ clip, asset }) => ({ clip, asset: asset!, key: getVideoLayerKey(clip, asset!) })), [active]);

  useEffect(() => {
    const currentMappings = new Map<string, number>();
    const retryBlockedPlayback = isPlaying && !previousIsPlaying.current;
    for (const { clip, asset, key } of videoLayers) {
      if (asset?.kind !== 'video') continue;
      const video = videoElements.current.get(key);
      if (!video) continue;
      const target = getClipSourceTime(clip, currentTime);
      const mapping = clip.start - clip.timelinePosition;
      const mappingChanged = previousMappings.current.get(key) !== mapping;
      currentMappings.set(key, mapping);
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA
        && shouldSeekPreviewVideo(video.currentTime, target, !isPlaying || mappingChanged || previousSeekRevision.current !== seekRevision)) {
        video.currentTime = target;
      }
      if (isPlaying) {
        const status = videoStatuses[key];
        const canAttemptPlayback = status !== 'unavailable'
          && status !== 'decode-error'
          && (status !== 'playback-blocked' || retryBlockedPlayback);
        if (video.paused && canAttemptPlayback) {
          void video.play().catch((error: unknown) => {
            const errorName = error instanceof Error ? error.name : '';
            const status = getPreviewPlaybackRejectionStatus(errorName);
            if (status) setVideoStatuses((previous) => ({ ...previous, [key]: status }));
          });
        }
      } else {
        video.pause();
      }
    }
    const activeKeys = new Set(videoLayers.map(({ key }) => key));
    videoElements.current.forEach((video, key) => {
      if (!activeKeys.has(key)) video.pause();
    });
    previousMappings.current = currentMappings;
    previousSeekRevision.current = seekRevision;
    previousIsPlaying.current = isPlaying;
  }, [currentTime, isPlaying, seekRevision, videoLayers, videoStatuses]);

  useEffect(() => {
    const currentKeys = new Set(videoLayers.map(({ key }) => key));
    setVideoStatuses((previous) => {
      const entries = Object.entries(previous).filter(([key]) => currentKeys.has(key));
      return entries.length === Object.keys(previous).length ? previous : Object.fromEntries(entries);
    });
  }, [videoLayers]);

  const statusMessages = videoLayers
    .map(({ key }, index) => {
      const message = getPreviewVideoStatusMessage(videoStatuses[key] ?? 'loading');
      return message ? { key, message: `Video layer ${index + 1}: ${message}`, isError: videoStatuses[key] !== undefined && videoStatuses[key] !== 'loading' && videoStatuses[key] !== 'ready' } : null;
    })
    .filter((item): item is { key: string; message: string; isError: boolean } => item !== null);
  const hasVideoError = statusMessages.some(({ isError }) => isError);

  return (
    <div
      className="relative mx-auto flex max-h-[58vh] w-full items-center justify-center overflow-hidden bg-neutral-950"
      style={{ aspectRatio: `${width} / ${height}` }}
      aria-label="Video composition preview"
    >
      {active.length ? active.map(({ clip, asset }, layerIndex) => {
        if (!asset) return null;
        const transform = clip.transform ?? defaultTransform;
        const style = {
          objectFit: transform.fit,
          transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom * (transform.flipX ? -1 : 1)}, ${transform.zoom * (transform.flipY ? -1 : 1)}) rotate(${transform.rotation}deg)`,
          opacity: 1,
          zIndex: layerIndex + 1,
        } as const;
        return asset.kind === 'image' ? (
          <img
            key={clip.id}
            src={asset.url}
            alt={`Visible visual layer ${layerIndex + 1}`}
            className="absolute inset-0 h-full w-full"
            style={style}
          />
        ) : (
          <video
            key={getVideoLayerKey(clip, asset)}
            src={asset.url}
            className="absolute inset-0 h-full w-full"
            muted
            playsInline
            preload="auto"
            ref={(element) => {
              const key = getVideoLayerKey(clip, asset);
              if (element) videoElements.current.set(key, element);
              else {
                videoElements.current.get(key)?.pause();
                videoElements.current.delete(key);
              }
            }}
            onLoadedMetadata={(event) => {
              const target = getClipSourceTime(clip, currentTime);
              const duration = event.currentTarget.duration;
              event.currentTarget.currentTime = Number.isFinite(duration) ? Math.min(target, duration) : target;
            }}
            onCanPlay={() => setVideoStatuses((previous) => ({ ...previous, [getVideoLayerKey(clip, asset)]: 'ready' }))}
            onPlaying={() => setVideoStatuses((previous) => ({ ...previous, [getVideoLayerKey(clip, asset)]: 'ready' }))}
            onError={(event) => setVideoStatuses((previous) => ({
              ...previous,
              [getVideoLayerKey(clip, asset)]: getPreviewVideoFailureStatus(event.currentTarget.error?.code ?? null),
            }))}
            style={{ ...style, objectFit: style.objectFit }}
          />
        );
      }) : !activeTitles.length ? (
        <div className="px-6 text-center text-sm text-neutral-500">
          {clips.length === 0
            ? 'Add clips to see your composition'
            : <><p>No visible clips at this time.</p><p className="mt-1 text-xs text-neutral-400">The playhead may be in a timeline gap or visual tracks may be hidden.</p></>}
        </div>
      ) : null}
      {statusMessages.length > 0 && (
        <div
          className="absolute left-3 top-3 z-[1000001] max-w-[min(90%,32rem)] space-y-1 rounded bg-black/75 px-3 py-2 text-xs text-white"
          role={hasVideoError ? 'alert' : 'status'}
          aria-live={hasVideoError ? 'assertive' : 'polite'}
        >
          {statusMessages.map(({ key, message }) => <p key={key}>{message}</p>)}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-[1000000] overflow-hidden" style={{ containerType: 'size' }}>
        {activeTitles.map((title) => {
          const mapped = mapTitleToOutput(title, width, height);
          return (
            <div
              key={title.id}
              className="absolute max-w-[90%] whitespace-pre-wrap break-words px-[0.3em] py-[0.15em]"
              style={{
                left: `${(mapped.x / width) * 100}%`,
                top: `${(mapped.y / height) * 100}%`,
                transform: 'translate(-50%, -50%)',
                fontFamily: mapped.fontFamily,
                fontSize: `${(mapped.fontSize / height) * 100}cqh`,
                fontWeight: title.fontWeight,
                lineHeight: 1.15,
                textAlign: title.align,
                color: title.color,
                backgroundColor: title.background ?? 'transparent',
                textShadow: title.shadow ? '0 2px 6px rgba(0,0,0,.8)' : 'none',
              }}
            >
              {title.text}
            </div>
          );
        })}
      </div>
      <span className="pointer-events-none absolute bottom-3 right-3 z-[1000] rounded-sm bg-black/55 px-2 py-1 text-[11px] text-white">
        {width} × {height}
      </span>
    </div>
  );
}

function getVideoLayerKey(clip: TimelineClip, asset: TimelineAsset): string {
  return JSON.stringify([clip.id, asset.id, asset.url]);
}

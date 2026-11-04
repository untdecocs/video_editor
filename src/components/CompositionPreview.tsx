import { useEffect, useMemo, useRef } from 'react';
import { defaultTransform, getActiveClips, getClipSourceTime, type TimelineAsset, type TimelineClip, type TimelineTrack } from '../services/timeline';
import { shouldSeekPreviewVideo } from '../services/videoPreview';
import { getActiveTitles, mapTitleToOutput, type TitleOverlay } from '../services/titleOverlay';

type CompositionPreviewProps = {
  assets: TimelineAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  titles: TitleOverlay[];
  currentTime: number;
  isPlaying: boolean;
  width: number;
  height: number;
};

export function CompositionPreview({ assets, tracks, clips, titles, currentTime, isPlaying, width, height }: CompositionPreviewProps) {
  const videoElements = useRef(new Map<string, HTMLVideoElement>());
  const active = useMemo(() => getActiveClips(tracks, clips, currentTime)
    .map(({ clip, elapsed }) => ({ clip, elapsed, asset: assets.find((item) => item.id === clip.assetId) }))
    .filter((item) => item.asset), [assets, clips, currentTime, tracks]);
  const activeTitles = useMemo(() => getActiveTitles(titles, currentTime), [titles, currentTime]);

  useEffect(() => {
    for (const { clip, asset } of active) {
      if (asset?.kind !== 'video') continue;
      const video = videoElements.current.get(clip.id);
      if (!video) continue;
      const target = getClipSourceTime(clip, currentTime);
      if (shouldSeekPreviewVideo(video.currentTime, target, !isPlaying)) {
        try { video.currentTime = target; } catch { /* Metadata may not be ready until the browser's next media event. */ }
      }
      if (isPlaying) void video.play().catch(() => undefined);
      else video.pause();
    }
    const activeIds = new Set(active.map(({ clip }) => clip.id));
    videoElements.current.forEach((video, id) => {
      if (!activeIds.has(id)) video.pause();
    });
  }, [active, isPlaying]);

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
            key={clip.id}
            src={asset.url}
            className="absolute inset-0 h-full w-full"
            muted
            playsInline
            preload="auto"
            ref={(element) => {
              if (element) videoElements.current.set(clip.id, element);
              else videoElements.current.delete(clip.id);
            }}
            onLoadedMetadata={(event) => {
              const target = getClipSourceTime(clip, currentTime);
              try { event.currentTarget.currentTime = Math.min(target, event.currentTarget.duration || target); } catch { /* Retry through the preview effect when time changes. */ }
            }}
            style={{ ...style, objectFit: style.objectFit }}
          />
        );
      }) : !activeTitles.length ? (
        <div className="px-6 text-center text-sm text-neutral-500">Add clips to see your composition</div>
      ) : null}
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

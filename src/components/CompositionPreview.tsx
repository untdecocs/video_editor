import { useEffect, useMemo, type RefObject } from 'react';
import { defaultTransform, type TimelineAsset, type TimelineClip } from '../services/timeline';
import { getClipDuration } from '../services/timeline';

type CompositionPreviewProps = {
  assets: TimelineAsset[];
  clips: TimelineClip[];
  currentTime: number;
  width: number;
  height: number;
  videoRef: RefObject<HTMLVideoElement>;
};

export function CompositionPreview({ assets, clips, currentTime, width, height, videoRef }: CompositionPreviewProps) {
  const active = useMemo(() => {
    let offset = 0;
    for (const clip of clips) {
      const duration = getClipDuration(clip);
      if (currentTime < offset + duration) {
        return { clip, asset: assets.find((item) => item.id === clip.assetId), elapsed: currentTime - offset };
      }
      offset += duration;
    }
    const clip = clips[clips.length - 1];
    return clip
      ? { clip, asset: assets.find((item) => item.id === clip.assetId), elapsed: getClipDuration(clip) }
      : null;
  }, [assets, clips, currentTime]);

  const clip = active?.clip;
  const asset = active?.asset;
  const transform = clip?.transform ?? defaultTransform;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip || asset?.kind !== 'video' || !active) return;
    const targetTime = Math.min(clip.start + active.elapsed, clip.end);
    if (Math.abs(video.currentTime - targetTime) > 0.4) video.currentTime = targetTime;
  }, [active, asset?.kind, clip, videoRef]);

  return (
    <div
      className="relative mx-auto flex max-h-[58vh] w-full items-center justify-center overflow-hidden bg-neutral-950"
      style={{ aspectRatio: `${width} / ${height}` }}
      aria-label="Video composition preview"
    >
      {asset && clip ? (
        asset.kind === 'image' ? (
          <img
            src={asset.url}
            alt="Current visual clip"
            className="h-full w-full"
            style={{
              objectFit: transform.fit,
              transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom * (transform.flipX ? -1 : 1)}, ${transform.zoom * (transform.flipY ? -1 : 1)}) rotate(${transform.rotation}deg)`,
            }}
          />
        ) : (
          <video
            key={asset.id}
            src={asset.url}
            className="h-full w-full object-cover"
            muted
            playsInline
            ref={videoRef}
            style={{
              objectFit: transform.fit,
              transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom * (transform.flipX ? -1 : 1)}, ${transform.zoom * (transform.flipY ? -1 : 1)}) rotate(${transform.rotation}deg)`,
            }}
            onLoadedMetadata={(event) => {
              const element = event.currentTarget;
              if (element && Number.isFinite(active.elapsed)) {
                const targetTime = Math.min(clip.start + active.elapsed, clip.end);
                if (Math.abs(element.currentTime - targetTime) > 0.35) element.currentTime = targetTime;
              }
            }}
          />
        )
      ) : (
        <div className="px-6 text-center text-sm text-neutral-500">Add clips to see your composition</div>
      )}
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-sm bg-black/55 px-2 py-1 text-[11px] text-white">
        {width} × {height}
      </span>
    </div>
  );
}

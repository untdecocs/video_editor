import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioAsset, AudioClip, AudioTrack, TimelineAsset, TimelineClip, TimelineMarker, TimelineTrack, VisualTransform } from '../services/timeline';
import type { TitleOverlay } from '../services/titleOverlay';
import {
  clampTimelineTime,
  getAudioClipDuration,
  getAudioTimelineDuration,
  getClipDuration,
  getStillDurationLimit,
  getTimelineDuration,
  getVideoTimelineDuration,
  getTimelinePositionFromDrop,
  MAX_TIMELINE_DURATION,
  MIN_STILL_DURATION,
  normalizeStillDuration,
} from '../services/timeline';

type TimelineEditorProps = {
  assets: TimelineAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  titles: TitleOverlay[];
  markers: TimelineMarker[];
  selectedTitleId: string;
  selectedClipId: string;
  selectedAudioClipId: string;
  currentTime: number;
  soundtrackDuration: number;
  audioAssets: AudioAsset[];
  audioTracks: AudioTrack[];
  audioClips: AudioClip[];
  pixelsPerSecond: number;
  snapEnabled: boolean;
  onSeek: (time: number) => void;
  onTrackChange: (id: string, patch: Partial<Pick<TimelineTrack, 'name' | 'visible' | 'locked'>>) => void;
  onAudioTrackChange: (id: string, patch: Partial<Pick<AudioTrack, 'name' | 'visible' | 'locked'>>) => void;
  onAddAudioTrack: () => void;
  onDuplicateAudioTrack: (id: string) => void;
  onRemoveAudioTrack: (id: string) => void;
  onMoveClip: (clipId: string, trackId: string, timelinePosition: number) => void;
  onMoveAudioClip: (clipId: string, trackId: string, timelinePosition: number) => void;
  onSelectAudioClip: (id: string) => void;
  onAudioClipChange: (id: string, patch: Partial<Pick<AudioClip, 'start' | 'end' | 'timelinePosition' | 'volume'>>) => void;
  onDuplicateAudioClip: (id: string) => void;
  onRemoveAudioClip: (id: string) => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<TimelineClip>) => void;
  onTransform: (id: string, patch: Partial<VisualTransform>, coalescingKey?: string) => void;
  onEndEditCoalescing: () => void;
  onRemove: (id: string) => void;
  onSplit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSelectTitle: (id: string) => void;
  onTitleChange: (id: string, patch: Partial<TitleOverlay>, coalescingKey?: string) => void;
  onSeekTitle: (time: number) => void;
  onAddMarker: () => void;
  onRenameMarker: (id: string, label: string) => void;
  onRemoveMarker: (id: string) => void;
};

const formatTime = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;

export function TimelineEditor({
  assets, tracks, clips, titles, markers, selectedTitleId, selectedClipId, selectedAudioClipId, currentTime, soundtrackDuration,
  audioAssets, audioTracks, audioClips,
  pixelsPerSecond, snapEnabled, onSeek, onTrackChange,
  onAudioTrackChange, onAddAudioTrack, onDuplicateAudioTrack, onRemoveAudioTrack, onMoveAudioClip, onSelectAudioClip,
  onAudioClipChange, onDuplicateAudioClip, onRemoveAudioClip,
  onMoveClip, onSelect, onChange, onTransform, onEndEditCoalescing, onRemove, onSplit, onDuplicate, onSelectTitle, onTitleChange, onSeekTitle,
  onAddMarker, onRenameMarker, onRemoveMarker,
}: TimelineEditorProps) {
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0]?.id ?? '');
  const [markerLabels, setMarkerLabels] = useState<Record<string, string>>({});
  const [stillDurationDraft, setStillDurationDraft] = useState('');
  const dragRef = useRef<{ clipId: string; grabOffsetPixels: number } | null>(null);
  const audioDragRef = useRef<{ clipId: string; grabOffsetPixels: number } | null>(null);
  const resizeTitleRef = useRef<{ id: string; pointerId: number; startX: number; startDuration: number } | null>(null);
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  // Show the visually highest (largest order) tracks first; renderers draw
  // low-to-high so this display order maps to top-to-bottom compositing.
  const orderedTracks = useMemo(() => [...tracks].sort((a, b) => b.order - a.order), [tracks]);
  const duration = Math.max(getTimelineDuration(clips), 1);
  const audioTimelineDuration = getAudioTimelineDuration(audioClips);
  const videoTimelineDuration = getVideoTimelineDuration(clips, assets, tracks);
  const timelineExtent = Math.max(duration, audioTimelineDuration, ...titles.map((title) => title.start + title.duration), ...markers.map((marker) => marker.time), 1);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const selectedAudioClip = audioClips.find((clip) => clip.id === selectedAudioClipId);
  const selectedAudioAsset = audioAssets.find((asset) => asset.id === selectedAudioClip?.assetId);
  const selectedAudioTrack = audioTracks.find((track) => track.id === selectedAudioClip?.trackId);
  const selectedAsset = assets.find((asset) => asset.id === selectedClip?.assetId);
  const selectedTrack = tracks.find((track) => track.id === selectedClip?.trackId);
  const trackLabelWidth = 160;
  const timelineWidth = Math.max(640, timelineExtent * pixelsPerSecond, timelineViewportWidth - trackLabelWidth);
  const ticks = Array.from({ length: Math.ceil(timelineExtent / 5) + 1 }, (_, index) => index * 5).filter((time) => time <= timelineExtent + 0.01);
  const seek = (time: number) => onSeek(clampTimelineTime(time, timelineExtent));

  useEffect(() => {
    setMarkerLabels(Object.fromEntries(markers.map((marker) => [marker.id, marker.label])));
  }, [markers]);

  useEffect(() => {
    setStillDurationDraft(selectedClip ? String(selectedClip.stillDuration) : '');
  }, [selectedClip?.id, selectedClip?.stillDuration]);

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;
    const updateWidth = () => setTimelineViewportWidth(viewport.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Timeline</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Position clips in time; higher video tracks render above lower tracks.
            {' '}Focus a clip and press ←/→ to move by 0.1s, or Shift+←/→ to move by 1s.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-neutral-500">{clips.length + audioClips.length} clips · {formatTime(timelineExtent)}</span>
          <button type="button" onClick={onAddAudioTrack} className="border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-950 hover:bg-sky-100">+ Add audio track</button>
        </div>
      </div>
      <div ref={timelineViewportRef} className="overflow-x-auto overscroll-x-contain rounded-md border border-neutral-200 bg-white">
        <div style={{ width: trackLabelWidth + timelineWidth }}>
          <div className="flex border-b border-neutral-200">
            <div className="w-40 shrink-0 border-r border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-500">TRACK / TIME</div>
            <div className="relative h-9" style={{ width: timelineWidth }}>
              {ticks.map((time) => (
                <button key={time} type="button" onClick={() => seek(time)} className="absolute inset-y-0 border-l border-neutral-200 pl-1 text-[10px] tabular-nums text-neutral-500 hover:text-ink" style={{ left: time * pixelsPerSecond }} aria-label={`Seek to ${formatTime(clampTimelineTime(time, timelineExtent))}`}>
                  {formatTime(time)}
                </button>
              ))}
              <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, timelineExtent) * pixelsPerSecond }} aria-hidden="true" />
            </div>
          </div>
          {orderedTracks.map((track) => (
            <div key={track.id} className="flex border-b border-neutral-200 last:border-b-0">
              <div className="flex w-40 shrink-0 flex-col justify-center gap-2 border-r border-neutral-200 bg-neutral-50 p-2">
                <button type="button" aria-pressed={selectedTrackId === track.id} onClick={() => setSelectedTrackId(track.id)} className={`truncate text-left text-[10px] font-semibold uppercase tracking-wide ${selectedTrackId === track.id ? 'text-moss' : 'text-neutral-500'}`}>Select track</button>
                <input aria-label={`${track.name} track name`} value={track.name} onChange={(event) => onTrackChange(track.id, { name: event.target.value })} className="min-w-0 border border-neutral-200 bg-white px-2 py-1 text-xs disabled:bg-neutral-100" />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[10px] text-neutral-600"><input type="checkbox" checked={track.visible} onChange={(event) => onTrackChange(track.id, { visible: event.target.checked })} />Visible</label>
                  <label className="flex items-center gap-1 text-[10px] text-neutral-600"><input type="checkbox" checked={track.locked} onChange={(event) => onTrackChange(track.id, { locked: event.target.checked })} />Locked</label>
                </div>
              </div>
              <div
                className={`relative h-[74px] ${track.locked ? 'bg-neutral-100' : 'bg-white'} ${selectedTrackId === track.id ? 'ring-1 ring-inset ring-moss' : ''}`}
                style={{ width: timelineWidth }}
                onDragOver={(event) => {
                  if (!track.locked) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const drag = dragRef.current;
                  const clipId = drag?.clipId ?? event.dataTransfer.getData('text/clip-id');
                  const position = getTimelinePositionFromDrop(
                    event.clientX,
                    event.currentTarget.getBoundingClientRect().left,
                    pixelsPerSecond,
                    drag?.grabOffsetPixels ?? 0,
                    snapEnabled,
                  );
                  if (clipId && !track.locked) onMoveClip(clipId, track.id, position);
                  dragRef.current = null;
                }}
                onClick={() => setSelectedTrackId(track.id)}
                aria-label={`${track.name} clips`}
              >
                {clips.filter((clip) => clip.trackId === track.id).map((clip) => {
                  const asset = assets.find((item) => item.id === clip.assetId);
                  const clipWidth = Math.max(36, getClipDuration(clip) * pixelsPerSecond);
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      draggable={!track.locked}
                      onDragStart={(event) => {
                        const clipBounds = event.currentTarget.getBoundingClientRect();
                        dragRef.current = {
                          clipId: clip.id,
                          grabOffsetPixels: event.clientX - clipBounds.left,
                        };
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/clip-id', clip.id);
                      }}
                      onDragEnd={() => { dragRef.current = null; }}
                      onClick={() => { onSelect(clip.id); seek(clip.timelinePosition); }}
                      onKeyDown={(event) => {
                        if ((event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') || event.altKey || event.ctrlKey || event.metaKey) return;
                        event.preventDefault();
                        const increment = event.shiftKey ? 1 : 0.1;
                        const maximumPosition = MAX_TIMELINE_DURATION - (asset?.kind === 'image' ? MIN_STILL_DURATION : 0);
                        const offset = event.key === 'ArrowLeft' ? -increment : increment;
                        const position = Math.min(maximumPosition, Math.max(0, clip.timelinePosition + offset));
                        onSelect(clip.id);
                        onMoveClip(clip.id, track.id, Number(position.toFixed(1)));
                      }}
                      className={`absolute top-2 h-[58px] overflow-hidden border px-2 text-left ${clip.id === selectedClipId ? 'z-10 border-moss ring-2 ring-moss' : 'border-emerald-800'} ${track.visible ? 'bg-emerald-100' : 'bg-neutral-200 opacity-60'} disabled:cursor-not-allowed`}
                      style={{ left: clip.timelinePosition * pixelsPerSecond, width: clipWidth }}
                      aria-pressed={clip.id === selectedClipId}
                      aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight"
                      disabled={track.locked}
                      title={`${asset?.file.name ?? 'Visual clip'} · ${formatTime(clip.timelinePosition)}`}
                    >
                      <span className="block truncate text-xs font-medium text-ink">{asset?.file.name ?? 'Missing media'}</span>
                      <span className="block truncate text-[10px] text-neutral-600">{formatTime(clip.timelinePosition)} · {getClipDuration(clip).toFixed(1)}s</span>
                    </button>
                  );
                })}
                <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, timelineExtent) * pixelsPerSecond }} aria-hidden="true" />
              </div>
            </div>
          ))}
          {[...audioTracks].sort((a, b) => b.order - a.order).map((track) => (
            <div key={track.id} className="flex border-b border-neutral-200">
              <div className="flex w-40 shrink-0 flex-col justify-center gap-1 border-r border-neutral-200 bg-sky-50 p-2">
                <input aria-label={`${track.name} track name`} value={track.name} onChange={(event) => onAudioTrackChange(track.id, { name: event.target.value })} className="min-w-0 border border-sky-200 bg-white px-2 py-1 text-xs disabled:bg-neutral-100" disabled={track.locked} />
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-1 text-[10px] text-neutral-600"><input type="checkbox" checked={track.visible} onChange={(event) => onAudioTrackChange(track.id, { visible: event.target.checked })} />On</label>
                  <button type="button" aria-label={`Duplicate ${track.name} track`} title="Duplicate audio track" onClick={() => onDuplicateAudioTrack(track.id)} className="ml-auto border border-sky-200 px-1.5 py-0.5 text-[10px] font-semibold text-sky-950 hover:bg-sky-100">⧉</button>
                  <button type="button" aria-label={`Remove ${track.name} track`} title="Remove audio track" onClick={() => onRemoveAudioTrack(track.id)} className="border border-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 hover:bg-red-50">×</button>
                </div>
              </div>
              <div
                className={`relative h-[52px] ${track.locked ? 'bg-neutral-100' : 'bg-sky-50/40'}`}
                style={{ width: timelineWidth }}
                onDragOver={(event) => { if (!track.locked) event.preventDefault(); }}
                onDrop={(event) => {
                  event.preventDefault();
                  const drag = audioDragRef.current;
                  const clipId = drag?.clipId ?? event.dataTransfer.getData('text/audio-clip-id');
                  const position = getTimelinePositionFromDrop(
                    event.clientX,
                    event.currentTarget.getBoundingClientRect().left,
                    pixelsPerSecond,
                    drag?.grabOffsetPixels ?? 0,
                    snapEnabled,
                  );
                  if (clipId && !track.locked) onMoveAudioClip(clipId, track.id, position);
                  audioDragRef.current = null;
                }}
                aria-label={`${track.name} audio clips`}
              >
                {audioClips.filter((clip) => clip.trackId === track.id).map((clip) => {
                  const asset = audioAssets.find((item) => item.id === clip.assetId);
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      draggable={!track.locked}
                      onDragStart={(event) => {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        audioDragRef.current = { clipId: clip.id, grabOffsetPixels: event.clientX - bounds.left };
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/audio-clip-id', clip.id);
                      }}
                      onDragEnd={() => { audioDragRef.current = null; }}
                      onClick={() => { onSelectAudioClip(clip.id); seek(clip.timelinePosition); }}
                      className={`absolute inset-y-2 overflow-hidden rounded-sm border px-2 text-left text-xs text-sky-950 hover:bg-sky-200 ${clip.id === selectedAudioClipId ? 'z-10 border-sky-700 bg-sky-200 ring-2 ring-sky-600' : 'border-sky-300 bg-sky-100'}`}
                      style={{ left: clip.timelinePosition * pixelsPerSecond, width: Math.max(36, getAudioClipDuration(clip) * pixelsPerSecond) }}
                      aria-label={`${asset?.file.name ?? 'Audio clip'}, ${formatTime(getAudioClipDuration(clip))}`}
                      title={`${asset?.file.name ?? 'Audio clip'} · ${formatTime(clip.timelinePosition)}–${formatTime(clip.timelinePosition + getAudioClipDuration(clip))}`}
                    >
                      <span className="block truncate">♫ {asset?.file.name ?? 'Audio clip'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex border-b border-neutral-200">
            <div className="flex w-40 shrink-0 flex-col justify-center border-r border-neutral-200 bg-lime/20 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-moss">Titles</span>
              <span className="text-[10px] text-neutral-500">Static overlays</span>
            </div>
            <div className="relative h-[52px] bg-neutral-50" style={{ width: timelineWidth }} aria-label="Title overlay timeline">
              {titles.map((title) => (
                <div key={title.id}>
                  <button
                    type="button"
                    aria-pressed={title.id === selectedTitleId}
                    aria-label={`Select title ${title.text.split('\n')[0]} from ${formatTime(title.start)} for ${title.duration.toFixed(1)} seconds`}
                    onClick={() => { onSelectTitle(title.id); onSeekTitle(title.start); }}
                    className={`absolute top-2 h-8 truncate border px-2 text-left text-[10px] font-semibold ${title.id === selectedTitleId ? 'z-10 border-moss bg-lime ring-2 ring-moss' : 'border-violet-300 bg-violet-100 text-violet-950'}`}
                    style={{ left: title.start * pixelsPerSecond, width: Math.max(28, title.duration * pixelsPerSecond) }}
                    title={`${title.text.split('\n')[0]} · ${formatTime(title.start)}–${formatTime(title.start + title.duration)}`}
                  >
                    {title.text.split('\n')[0]}
                  </button>
                  <button
                    type="button"
                    aria-label={`Resize ${title.text.split('\n')[0]} title duration`}
                    title="Drag to resize title duration; use arrow keys for precise adjustment"
                    className="absolute top-2 z-20 h-8 w-2 cursor-ew-resize touch-none rounded-r border border-violet-500 bg-violet-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss"
                    style={{ left: (title.start + title.duration) * pixelsPerSecond - 4 }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      resizeTitleRef.current = {
                        id: title.id,
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startDuration: title.duration,
                      };
                      onSelectTitle(title.id);
                    }}
                    onPointerMove={(event) => {
                      const resize = resizeTitleRef.current;
                      if (!resize || resize.id !== title.id || resize.pointerId !== event.pointerId) return;
                      const duration = Math.max(0.1, Math.min(
                        86_400 - title.start,
                        resize.startDuration + (event.clientX - resize.startX) / pixelsPerSecond,
                      ));
                      onTitleChange(title.id, { duration: Number(duration.toFixed(1)) }, `title:${title.id}:duration`);
                    }}
                    onPointerUp={(event) => {
                      if (resizeTitleRef.current?.pointerId !== event.pointerId) return;
                      resizeTitleRef.current = null;
                      onEndEditCoalescing();
                    }}
                    onPointerCancel={() => {
                      resizeTitleRef.current = null;
                      onEndEditCoalescing();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                      event.preventDefault();
                      const delta = event.key === 'ArrowRight' ? (event.shiftKey ? 1 : 0.1) : (event.shiftKey ? -1 : -0.1);
                      onTitleChange(title.id, {
                        duration: Math.max(0.1, Math.min(86_400 - title.start, Number((title.duration + delta).toFixed(1)))),
                      });
                    }}
                    onKeyUp={onEndEditCoalescing}
                    onBlur={onEndEditCoalescing}
                  />
                </div>
              ))}
              <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, timelineExtent) * pixelsPerSecond }} aria-hidden="true" />
              {!titles.length && <span className="absolute left-3 top-3 text-[10px] text-neutral-400">Add titles below to see their timing here.</span>}
            </div>
          </div>
          <div className="flex border-b border-neutral-200">
            <div className="flex w-40 shrink-0 flex-col justify-center border-r border-neutral-200 bg-amber-50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">Markers</span>
              <span className="text-[10px] text-neutral-500">Timeline points</span>
            </div>
            <div className="relative h-10 bg-amber-50/40" style={{ width: timelineWidth }} aria-label="Timeline markers">
              {markers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() => seek(marker.time)}
                  aria-label={`Seek to marker ${marker.label} at ${formatTime(marker.time)}`}
                  title={`${marker.label} · ${formatTime(marker.time)}`}
                  className="absolute top-1 z-10 max-w-32 -translate-x-1/2 truncate border border-amber-400 bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-950 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-700"
                  style={{ left: marker.time * pixelsPerSecond }}
                >
                  {marker.label}
                </button>
              ))}
              <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, timelineExtent) * pixelsPerSecond }} aria-hidden="true" />
              {!markers.length && <span className="absolute left-3 top-3 text-[10px] text-neutral-400">Add a marker to save a point on the timeline.</span>}
            </div>
          </div>
          {!clips.length && <p className="px-4 py-8 text-sm text-neutral-500">Add an image or video in the previous step.</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-neutral-600">Playhead · {formatTime(clampTimelineTime(currentTime, timelineExtent))} / {formatTime(timelineExtent)}</span>
        <input aria-label="Timeline playhead" type="range" min="0" max={Math.max(timelineExtent, 0.1)} step="0.1" value={clampTimelineTime(currentTime, timelineExtent)} onChange={(event) => seek(Number(event.target.value))} className="min-w-40 flex-1 accent-moss" />
      </div>
      <div className="space-y-3 rounded-sm border border-neutral-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Timeline markers</h4>
            <p className="mt-1 text-[11px] text-neutral-500">Add a named point at the current playhead. Select a marker to seek.</p>
          </div>
          <button type="button" onClick={onAddMarker} className="border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
            Add marker at playhead · {formatTime(clampTimelineTime(currentTime, timelineExtent))}
          </button>
        </div>
        {markers.length > 0 && (
          <ul className="space-y-2">
            {markers.map((marker) => {
              const label = markerLabels[marker.id] ?? marker.label;
              return (
                <li key={marker.id} className="flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-2">
                  <label className="min-w-40 flex-1 text-[11px] font-medium text-neutral-600">
                    Marker label · {formatTime(marker.time)}
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={label}
                      aria-label={`Label for marker at ${formatTime(marker.time)}`}
                      onChange={(event) => setMarkerLabels((current) => ({ ...current, [marker.id]: event.target.value }))}
                      onBlur={() => {
                        const trimmedLabel = label.trim();
                        if (trimmedLabel && trimmedLabel.length <= 80) onRenameMarker(marker.id, trimmedLabel);
                        else setMarkerLabels((current) => ({ ...current, [marker.id]: marker.label }));
                      }}
                      className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-xs text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss"
                    />
                  </label>
                  <button type="button" onClick={() => seek(marker.time)} className="border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50" aria-label={`Go to marker ${marker.label} at ${formatTime(marker.time)}`}>Go to</button>
                  <button type="button" onClick={() => onRemoveMarker(marker.id)} className="border border-red-200 px-3 py-2 text-xs text-red-800 hover:bg-red-50" aria-label={`Delete marker ${marker.label}`}>Delete</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selectedClip && selectedAsset && (
        <div className="grid gap-5 2xl:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Clip timing</h4>
            <label className="block text-xs text-neutral-600">Timeline position (sec)
              <input
                className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm"
                type="number"
                min="0"
                max={selectedAsset.kind === 'image' ? MAX_TIMELINE_DURATION - MIN_STILL_DURATION : MAX_TIMELINE_DURATION}
                step="0.1"
                value={selectedClip.timelinePosition}
                disabled={selectedTrack?.locked}
                onChange={(event) => {
                  const position = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(position)) {
                    onChange(selectedClip.id, {
                      timelinePosition: Math.max(0, Math.min(
                        position,
                        selectedAsset.kind === 'image' ? MAX_TIMELINE_DURATION - MIN_STILL_DURATION : MAX_TIMELINE_DURATION,
                      )),
                    });
                  }
                }}
              />
            </label>
            {selectedAsset.kind === 'video' ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-neutral-600">Source in (sec)
                  <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min="0" max={selectedAsset.duration} step="0.1" value={selectedClip.start} disabled={selectedTrack?.locked} onChange={(event) => onChange(selectedClip.id, { start: Math.max(0, Math.min(Number(event.target.value), selectedClip.end - 0.1)) })} />
                </label>
                <label className="text-xs text-neutral-600">Source out (sec)
                  <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min={selectedClip.start + 0.1} max={selectedAsset.duration} step="0.1" value={selectedClip.end} disabled={selectedTrack?.locked} onChange={(event) => onChange(selectedClip.id, { end: Math.max(selectedClip.start + 0.1, Math.min(Number(event.target.value), selectedAsset.duration)) })} />
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs text-neutral-600" htmlFor="still-duration-mode">Still duration mode</label>
                <select
                  id="still-duration-mode"
                  className="w-full border border-neutral-200 bg-white px-2 py-2 text-sm"
                  value={selectedClip.stillDurationMode}
                  disabled={selectedTrack?.locked}
                  onChange={(event) => onChange(selectedClip.id, { stillDurationMode: event.target.value as TimelineClip['stillDurationMode'] })}
                >
                  <option value="custom">Custom duration</option>
                  <option value="match-audio" disabled={soundtrackDuration <= 0}>Match soundtrack</option>
                  <option value="match-video" disabled={videoTimelineDuration <= 0}>Match video track</option>
                </select>
                {selectedClip.stillDurationMode === 'custom' ? (
                  <label className="block text-xs text-neutral-600" htmlFor="still-duration">Custom duration (seconds)
                    <input
                      id="still-duration"
                      className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm"
                      type="number"
                      min={MIN_STILL_DURATION}
                      max={getStillDurationLimit(selectedClip.timelinePosition)}
                      step="0.1"
                      value={stillDurationDraft}
                      disabled={selectedTrack?.locked}
                      onChange={(event) => setStillDurationDraft(event.currentTarget.value)}
                      onBlur={() => {
                        const value = Number(stillDurationDraft);
                        if (Number.isFinite(value) && stillDurationDraft.trim()) {
                          const duration = normalizeStillDuration(value, selectedClip.timelinePosition);
                          onChange(selectedClip.id, { stillDuration: duration });
                          setStillDurationDraft(String(duration));
                        } else {
                          setStillDurationDraft(String(selectedClip.stillDuration));
                        }
                      }}
                    />
                  </label>
                ) : (
                  <p className="text-xs text-neutral-500">
                    {selectedClip.stillDurationMode === 'match-audio'
                      ? soundtrackDuration > 0
                        ? `Matches the soundtrack · ${selectedClip.stillDuration.toFixed(1)} sec`
                        : `Soundtrack duration is unavailable. The last usable still duration (${selectedClip.stillDuration.toFixed(1)} sec) is preserved.`
                      : `Matches the longest video track · ${selectedClip.stillDuration.toFixed(1)} sec`}
                  </p>
                )}
                {selectedAudioClip && selectedAudioAsset && (
                  <div className="space-y-3 rounded-sm border border-sky-200 bg-sky-50/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-950">Audio clip</h4>
                        <p className="truncate text-xs text-neutral-600" title={selectedAudioAsset.file.name}>{selectedAudioAsset.file.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => onDuplicateAudioClip(selectedAudioClip.id)} disabled={selectedAudioTrack?.locked} className="border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-950 hover:bg-sky-100 disabled:opacity-50">Duplicate clip</button>
                        <button type="button" onClick={() => onRemoveAudioClip(selectedAudioClip.id)} disabled={selectedAudioTrack?.locked} className="border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">Remove clip</button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-xs text-neutral-600">Timeline position (sec)
                        <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min="0" max={MAX_TIMELINE_DURATION} step="0.1" value={selectedAudioClip.timelinePosition} disabled={selectedAudioTrack?.locked} onChange={(event) => onAudioClipChange(selectedAudioClip.id, { timelinePosition: Number(event.target.value) })} />
                      </label>
                      <label className="text-xs text-neutral-600">Source in (sec)
                        <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min="0" max={selectedAudioAsset.duration} step="0.1" value={selectedAudioClip.start} disabled={selectedAudioTrack?.locked} onChange={(event) => onAudioClipChange(selectedAudioClip.id, { start: Number(event.target.value) })} />
                      </label>
                      <label className="text-xs text-neutral-600">Source out (sec)
                        <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min={selectedAudioClip.start + 0.1} max={selectedAudioAsset.duration} step="0.1" value={selectedAudioClip.end} disabled={selectedAudioTrack?.locked} onChange={(event) => onAudioClipChange(selectedAudioClip.id, { end: Number(event.target.value) })} />
                      </label>
                      <label className="text-xs text-neutral-600">Volume · {Math.round(selectedAudioClip.volume * 100)}%
                        <input className="mt-2 w-full accent-sky-700" type="range" min="0" max="2" step="0.05" value={selectedAudioClip.volume} disabled={selectedAudioTrack?.locked} onChange={(event) => onAudioClipChange(selectedAudioClip.id, { volume: Number(event.target.value) })} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
            <label className="block text-xs text-neutral-600">Transition into clip
              <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transition} disabled={selectedTrack?.locked} onChange={(event) => onChange(selectedClip.id, { transition: event.target.value as TimelineClip['transition'] })}>
                <option value="none">Cut</option><option value="fade">Fade</option>
              </select>
            </label>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Clip framing</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-neutral-600">Fit
                <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transform.fit} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { fit: event.target.value as VisualTransform['fit'] })}><option value="cover">Fill frame</option><option value="contain">Fit entire image</option></select>
              </label>
              <label className="text-xs text-neutral-600">Zoom · {selectedClip.transform.zoom.toFixed(1)}×
                <input className="mt-2 w-full accent-moss" type="range" min="0.5" max="3" step="0.1" value={selectedClip.transform.zoom} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { zoom: Number(event.target.value) }, `transform:${selectedClip.id}:zoom`)} onPointerUp={onEndEditCoalescing} onPointerCancel={onEndEditCoalescing} onKeyUp={onEndEditCoalescing} onBlur={onEndEditCoalescing} />
              </label>
              <label className="text-xs text-neutral-600">Horizontal position
                <input className="mt-2 w-full accent-moss" type="range" min="-50" max="50" value={selectedClip.transform.x} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { x: Number(event.target.value) }, `transform:${selectedClip.id}:x`)} onPointerUp={onEndEditCoalescing} onPointerCancel={onEndEditCoalescing} onKeyUp={onEndEditCoalescing} onBlur={onEndEditCoalescing} />
              </label>
              <label className="text-xs text-neutral-600">Vertical position
                <input className="mt-2 w-full accent-moss" type="range" min="-50" max="50" value={selectedClip.transform.y} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { y: Number(event.target.value) }, `transform:${selectedClip.id}:y`)} onPointerUp={onEndEditCoalescing} onPointerCancel={onEndEditCoalescing} onKeyUp={onEndEditCoalescing} onBlur={onEndEditCoalescing} />
              </label>
              <label className="text-xs text-neutral-600">Rotation
                <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transform.rotation} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { rotation: Number(event.target.value) })}><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select>
              </label>
              <div className="flex items-end gap-3 pb-2">
                <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={selectedClip.transform.flipX} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { flipX: event.target.checked })} />Flip horizontal</label>
                <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={selectedClip.transform.flipY} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { flipY: event.target.checked })} />Flip vertical</label>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

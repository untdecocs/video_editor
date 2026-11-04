import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineAsset, TimelineClip, TimelineMarker, TimelineTrack, VisualTransform } from '../services/timeline';
import type { TitleOverlay } from '../services/titleOverlay';
import {
  clampTimelineTime,
  getClipDuration,
  getTimelineDuration,
  getTimelinePositionFromDrop,
} from '../services/timeline';

type TimelineEditorProps = {
  assets: TimelineAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  titles: TitleOverlay[];
  markers: TimelineMarker[];
  selectedTitleId: string;
  selectedClipId: string;
  currentTime: number;
  soundtrackDuration: number;
  onSeek: (time: number) => void;
  onAddTrack: () => void;
  onTrackChange: (id: string, patch: Partial<Pick<TimelineTrack, 'name' | 'visible' | 'locked'>>) => void;
  onMoveClip: (clipId: string, trackId: string, timelinePosition: number) => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<TimelineClip>) => void;
  onTransform: (id: string, patch: Partial<VisualTransform>) => void;
  onRemove: (id: string) => void;
  onSplit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSelectTitle: (id: string) => void;
  onSeekTitle: (time: number) => void;
  onAddMarker: () => void;
  onRenameMarker: (id: string, label: string) => void;
  onRemoveMarker: (id: string) => void;
};

const formatTime = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;

export function TimelineEditor({
  assets, tracks, clips, titles, markers, selectedTitleId, selectedClipId, currentTime, soundtrackDuration, onSeek, onAddTrack, onTrackChange,
  onMoveClip, onSelect, onChange, onTransform, onRemove, onSplit, onDuplicate, onSelectTitle, onSeekTitle,
  onAddMarker, onRenameMarker, onRemoveMarker,
}: TimelineEditorProps) {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(48);
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0]?.id ?? '');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [markerLabels, setMarkerLabels] = useState<Record<string, string>>({});
  const dragRef = useRef<{ clipId: string; grabOffsetPixels: number } | null>(null);
  // Show the visually highest (largest order) tracks first; renderers draw
  // low-to-high so this display order maps to top-to-bottom compositing.
  const orderedTracks = useMemo(() => [...tracks].sort((a, b) => b.order - a.order), [tracks]);
  const duration = Math.max(getTimelineDuration(clips), 1);
  const timelineExtent = Math.max(duration, soundtrackDuration, ...titles.map((title) => title.start + title.duration), ...markers.map((marker) => marker.time), 1);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const selectedAsset = assets.find((asset) => asset.id === selectedClip?.assetId);
  const selectedTrack = tracks.find((track) => track.id === selectedClip?.trackId);
  const timelineWidth = Math.max(640, timelineExtent * pixelsPerSecond);
  const ticks = Array.from({ length: Math.ceil(timelineExtent / 5) + 1 }, (_, index) => index * 5).filter((time) => time <= timelineExtent + 0.01);
  const seek = (time: number) => onSeek(clampTimelineTime(time, soundtrackDuration));

  useEffect(() => {
    setMarkerLabels(Object.fromEntries(markers.map((marker) => [marker.id, marker.label])));
  }, [markers]);

  return (
    <section className="space-y-4 border-t border-neutral-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Visual timeline</h3>
          <p className="mt-1 text-xs text-neutral-500">Clips use absolute positions and may overlap; higher tracks render above lower tracks.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-neutral-500">{clips.length} clips · {formatTime(duration)}</span>
          <button type="button" onClick={onAddTrack} className="border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">Add video track</button>
        </div>
      </div>
      <p className="rounded-sm bg-amber-50 px-3 py-2 text-xs text-amber-900">One soundtrack is supported. Multiple audio clips and audio tracks are not implemented. Visual clips positioned after the soundtrack ends will not play or export in this iteration.</p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-neutral-600" htmlFor="timeline-zoom">Timeline zoom</label>
        <input id="timeline-zoom" type="range" min="24" max="120" step="4" value={pixelsPerSecond} onChange={(event) => setPixelsPerSecond(Number(event.target.value))} className="w-36 accent-moss" />
        <span className="text-xs tabular-nums text-neutral-500">{pixelsPerSecond}px/s</span>
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(event) => setSnapEnabled(event.target.checked)}
            aria-label="Snap clip drag positions to 0.1-second increments"
          />
          Snap clip drag positions (0.1s): <span className="font-semibold text-ink">{snapEnabled ? 'On' : 'Off'}</span>
        </label>
      </div>
      <div className="overflow-x-auto border border-neutral-200 bg-white">
        <div className="min-w-max">
          <div className="flex border-b border-neutral-200">
            <div className="w-40 shrink-0 border-r border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-500">TRACK / TIME</div>
            <div className="relative h-9" style={{ width: timelineWidth }}>
              {ticks.map((time) => (
                <button key={time} type="button" onClick={() => seek(time)} className="absolute inset-y-0 border-l border-neutral-200 pl-1 text-[10px] tabular-nums text-neutral-500 hover:text-ink" style={{ left: time * pixelsPerSecond }} aria-label={`Seek to ${formatTime(clampTimelineTime(time, soundtrackDuration))}`}>
                  {formatTime(time)}
                </button>
              ))}
              <div className="absolute bottom-0 top-0 z-10 border-l-2 border-dashed border-amber-500" style={{ left: soundtrackDuration * pixelsPerSecond }} title={`Soundtrack ends at ${formatTime(soundtrackDuration)}`} aria-label={`Soundtrack ends at ${formatTime(soundtrackDuration)}`} />
              <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, soundtrackDuration) * pixelsPerSecond }} aria-hidden="true" />
              <span className="pointer-events-none absolute top-0 z-20 whitespace-nowrap bg-amber-100 px-1 text-[9px] font-semibold uppercase text-amber-900" style={{ left: soundtrackDuration * pixelsPerSecond }}>Soundtrack end</span>
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
                      className={`absolute top-2 h-[58px] overflow-hidden border px-2 text-left ${clip.id === selectedClipId ? 'z-10 border-moss ring-2 ring-moss' : 'border-emerald-800'} ${track.visible ? 'bg-emerald-100' : 'bg-neutral-200 opacity-60'} disabled:cursor-not-allowed`}
                      style={{ left: clip.timelinePosition * pixelsPerSecond, width: clipWidth }}
                      aria-pressed={clip.id === selectedClipId}
                      disabled={track.locked}
                      title={`${asset?.file.name ?? 'Visual clip'} · ${formatTime(clip.timelinePosition)}`}
                    >
                      <span className="block truncate text-xs font-medium text-ink">{asset?.file.name ?? 'Missing media'}</span>
                      <span className="block truncate text-[10px] text-neutral-600">{formatTime(clip.timelinePosition)} · {getClipDuration(clip).toFixed(1)}s</span>
                    </button>
                  );
                })}
                <div className="pointer-events-none absolute bottom-0 top-0 z-10 border-l-2 border-dashed border-amber-500" style={{ left: soundtrackDuration * pixelsPerSecond }} aria-hidden="true" />
                <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, soundtrackDuration) * pixelsPerSecond }} aria-hidden="true" />
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
                <button
                  key={title.id}
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
              ))}
              <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, soundtrackDuration) * pixelsPerSecond }} aria-hidden="true" />
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
              <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-rose-500" style={{ left: clampTimelineTime(currentTime, soundtrackDuration) * pixelsPerSecond }} aria-hidden="true" />
              {!markers.length && <span className="absolute left-3 top-3 text-[10px] text-neutral-400">Add a marker to save a point on the timeline.</span>}
            </div>
          </div>
          {!clips.length && <p className="px-4 py-8 text-sm text-neutral-500">Add an image or video in the previous step.</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-neutral-600">Playhead · {formatTime(clampTimelineTime(currentTime, soundtrackDuration))} / {formatTime(soundtrackDuration)}</span>
        <input aria-label="Timeline playhead" type="range" min="0" max={Math.max(soundtrackDuration, 0.1)} step="0.1" value={clampTimelineTime(currentTime, soundtrackDuration)} onChange={(event) => seek(Number(event.target.value))} className="min-w-40 flex-1 accent-moss" />
      </div>
      <div className="space-y-3 rounded-sm border border-neutral-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Timeline markers</h4>
            <p className="mt-1 text-[11px] text-neutral-500">Add a named point at the current playhead. Select a marker to seek.</p>
          </div>
          <button type="button" onClick={onAddMarker} className="border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
            Add marker at playhead · {formatTime(clampTimelineTime(currentTime, soundtrackDuration))}
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
              <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min="0" step="0.1" value={selectedClip.timelinePosition} disabled={selectedTrack?.locked} onChange={(event) => onChange(selectedClip.id, { timelinePosition: Math.max(0, Number(event.target.value)) })} />
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
              <label className="block text-xs text-neutral-600">Still duration · {selectedClip.stillDuration}s
                <input className="mt-2 w-full accent-moss" type="range" min="1" max="30" step="1" value={selectedClip.stillDuration} disabled={selectedTrack?.locked} onChange={(event) => onChange(selectedClip.id, { stillDuration: Number(event.target.value) })} />
              </label>
            )}
            <label className="block text-xs text-neutral-600">Transition into clip
              <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transition} disabled={selectedTrack?.locked} onChange={(event) => onChange(selectedClip.id, { transition: event.target.value as TimelineClip['transition'] })}>
                <option value="none">Cut</option><option value="fade">Fade</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40" type="button" disabled={selectedTrack?.locked || currentTime <= selectedClip.timelinePosition || currentTime >= selectedClip.timelinePosition + getClipDuration(selectedClip)} onClick={() => onSplit(selectedClip.id)}>Split at playhead</button>
              <button className="border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={selectedTrack?.locked} onClick={() => onDuplicate(selectedClip.id)}>Duplicate clip</button>
              <button className="border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40" type="button" disabled={selectedTrack?.locked} onClick={() => onRemove(selectedClip.id)}>Remove clip</button>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Image framing</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-neutral-600">Fit
                <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transform.fit} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { fit: event.target.value as VisualTransform['fit'] })}><option value="cover">Fill frame</option><option value="contain">Fit entire image</option></select>
              </label>
              <label className="text-xs text-neutral-600">Zoom · {selectedClip.transform.zoom.toFixed(1)}×
                <input className="mt-2 w-full accent-moss" type="range" min="0.5" max="3" step="0.1" value={selectedClip.transform.zoom} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { zoom: Number(event.target.value) })} />
              </label>
              <label className="text-xs text-neutral-600">Horizontal position
                <input className="mt-2 w-full accent-moss" type="range" min="-50" max="50" value={selectedClip.transform.x} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { x: Number(event.target.value) })} />
              </label>
              <label className="text-xs text-neutral-600">Vertical position
                <input className="mt-2 w-full accent-moss" type="range" min="-50" max="50" value={selectedClip.transform.y} disabled={selectedTrack?.locked} onChange={(event) => onTransform(selectedClip.id, { y: Number(event.target.value) })} />
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

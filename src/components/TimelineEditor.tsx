import type { TimelineAsset, TimelineClip, VisualTransform } from '../services/timeline';
import { getClipDuration } from '../services/timeline';

type TimelineEditorProps = {
  assets: TimelineAsset[];
  clips: TimelineClip[];
  selectedClipId: string;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<TimelineClip>) => void;
  onTransform: (id: string, patch: Partial<VisualTransform>) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onSplit: (id: string) => void;
};

export function TimelineEditor({
  assets,
  clips,
  selectedClipId,
  onSelect,
  onChange,
  onTransform,
  onMove,
  onRemove,
  onSplit,
}: TimelineEditorProps) {
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const selectedAsset = assets.find((asset) => asset.id === selectedClip?.assetId);

  return (
    <section className="space-y-4 border-t border-neutral-200 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Visual timeline</h3>
          <p className="mt-1 text-xs text-neutral-500">Drag to reorder. Audio sets the final duration.</p>
        </div>
        <span className="text-xs tabular-nums text-neutral-500">{clips.length} clips</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Timeline clips">
        {clips.map((clip, index) => {
          const asset = assets.find((item) => item.id === clip.assetId);
          return (
            <button
              key={clip.id}
              type="button"
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onMove(Number(event.dataTransfer.getData('text/plain')), index);
              }}
              onClick={() => onSelect(clip.id)}
              className={`w-32 shrink-0 border text-left ${clip.id === selectedClipId ? 'border-moss ring-1 ring-moss' : 'border-neutral-200'} bg-white`}
              aria-pressed={clip.id === selectedClipId}
            >
              {asset?.kind === 'image' ? (
                <img className="h-16 w-full object-cover" src={asset.url} alt="" />
              ) : (
                <video className="h-16 w-full object-cover" src={asset?.url} muted preload="metadata" />
              )}
              <span className="block truncate px-2 py-1 text-xs text-ink">{asset?.file.name}</span>
              <span className="block px-2 pb-2 text-[10px] text-neutral-500">{getClipDuration(clip).toFixed(1)} sec</span>
            </button>
          );
        })}
        {!clips.length && <p className="py-4 text-sm text-neutral-500">Add an image or video in the previous step.</p>}
      </div>
      {selectedClip && selectedAsset && (
        <div className="grid gap-5 2xl:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Clip timing</h4>
            {selectedAsset.kind === 'video' ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-neutral-600">In (sec)
                  <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min="0" max={selectedAsset.duration} step="0.1" value={selectedClip.start} onChange={(event) => onChange(selectedClip.id, { start: Math.max(0, Math.min(Number(event.target.value), selectedClip.end - 0.1)) })} />
                </label>
                <label className="text-xs text-neutral-600">Out (sec)
                  <input className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" type="number" min={selectedClip.start + 0.1} max={selectedAsset.duration} step="0.1" value={selectedClip.end} onChange={(event) => onChange(selectedClip.id, { end: Math.max(selectedClip.start + 0.1, Math.min(Number(event.target.value), selectedAsset.duration)) })} />
                </label>
              </div>
            ) : (
              <label className="block text-xs text-neutral-600">Still duration · {selectedClip.stillDuration}s
                <input className="mt-2 w-full accent-moss" type="range" min="1" max="30" step="1" value={selectedClip.stillDuration} onChange={(event) => onChange(selectedClip.id, { stillDuration: Number(event.target.value) })} />
              </label>
            )}
            <label className="block text-xs text-neutral-600">Transition into clip
              <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transition} onChange={(event) => onChange(selectedClip.id, { transition: event.target.value as TimelineClip['transition'] })}>
                <option value="none">Cut</option>
                <option value="fade">Fade</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedAsset.kind === 'video' && <button className="border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50" type="button" onClick={() => onSplit(selectedClip.id)}>Split at midpoint</button>}
              <button className="border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50" type="button" onClick={() => onRemove(selectedClip.id)}>Remove clip</button>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Image framing</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-neutral-600">Fit
                <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transform.fit} onChange={(event) => onTransform(selectedClip.id, { fit: event.target.value as VisualTransform['fit'] })}>
                  <option value="cover">Fill frame</option><option value="contain">Fit entire image</option>
                </select>
              </label>
              <label className="text-xs text-neutral-600">Zoom · {selectedClip.transform.zoom.toFixed(1)}×
                <input className="mt-2 w-full accent-moss" type="range" min="0.5" max="3" step="0.1" value={selectedClip.transform.zoom} onChange={(event) => onTransform(selectedClip.id, { zoom: Number(event.target.value) })} />
              </label>
              <label className="text-xs text-neutral-600">Horizontal position
                <input className="mt-2 w-full accent-moss" type="range" min="-50" max="50" value={selectedClip.transform.x} onChange={(event) => onTransform(selectedClip.id, { x: Number(event.target.value) })} />
              </label>
              <label className="text-xs text-neutral-600">Vertical position
                <input className="mt-2 w-full accent-moss" type="range" min="-50" max="50" value={selectedClip.transform.y} onChange={(event) => onTransform(selectedClip.id, { y: Number(event.target.value) })} />
              </label>
              <label className="text-xs text-neutral-600">Rotation
                <select className="mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm" value={selectedClip.transform.rotation} onChange={(event) => onTransform(selectedClip.id, { rotation: Number(event.target.value) })}>
                  <option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option>
                </select>
              </label>
              <div className="flex items-end gap-3 pb-2">
                <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={selectedClip.transform.flipX} onChange={(event) => onTransform(selectedClip.id, { flipX: event.target.checked })} />Flip horizontal</label>
                <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={selectedClip.transform.flipY} onChange={(event) => onTransform(selectedClip.id, { flipY: event.target.checked })} />Flip vertical</label>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

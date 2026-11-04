import type { TitleAlignment, TitleFontFamily, TitleOverlay } from '../services/titleOverlay';

type Props = {
  titles: TitleOverlay[];
  selectedTitleId: string;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<TitleOverlay>) => void;
  onRemove: (id: string) => void;
};

const fieldClass = 'mt-1 w-full border border-neutral-200 bg-white px-2 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss';
const labelClass = 'block text-xs text-neutral-600';
const formatTime = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;

export function TitleOverlayEditor({ titles, selectedTitleId, onAdd, onSelect, onChange, onRemove }: Props) {
  const selected = titles.find((title) => title.id === selectedTitleId);

  return (
    <section aria-labelledby="titles-heading" className="space-y-4 border-t border-neutral-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="titles-heading" className="text-sm font-semibold text-ink">Static titles</h3>
          <p className="mt-1 text-xs text-neutral-500">Titles appear over all video tracks only during their timeline range.</p>
        </div>
        <button type="button" onClick={onAdd} className="border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">Add title</button>
      </div>
      {titles.length > 0 ? (
        <ul aria-label="Title overlays" className="flex flex-wrap gap-2">
          {titles.map((title) => (
            <li key={title.id}>
              <button
                type="button"
                aria-pressed={title.id === selectedTitleId}
                onClick={() => onSelect(title.id)}
                className={`max-w-56 truncate border px-3 py-2 text-left text-xs ${title.id === selectedTitleId ? 'border-moss bg-lime/30 font-semibold' : 'border-neutral-200 bg-white'}`}
              >
                {title.text.split('\n')[0]} · {formatTime(title.start)}–{formatTime(title.start + title.duration)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border border-dashed border-neutral-300 px-4 py-5 text-sm text-neutral-500">No titles yet. Add a title to create a static overlay.</p>
      )}

      {selected && (
        <div className="grid gap-4 border border-neutral-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-3">
          <label className={`${labelClass} md:col-span-2 xl:col-span-3`}>Title text
            <textarea className={fieldClass} rows={3} maxLength={500} value={selected.text} onChange={(event) => onChange(selected.id, { text: event.target.value })} aria-describedby="title-text-help" />
            <span id="title-text-help" className="mt-1 block text-[11px] text-neutral-500">Up to 500 characters; line breaks are preserved.</span>
          </label>
          <label className={labelClass}>Start (seconds)
            <input className={fieldClass} type="number" min="0" max="86400" step="0.1" value={selected.start} onChange={(event) => onChange(selected.id, { start: Math.max(0, Math.min(86400 - selected.duration, Number(event.target.value) || 0)) })} />
          </label>
          <label className={labelClass}>Duration (seconds)
            <input className={fieldClass} type="number" min="0.1" max={Math.max(0.1, 86400 - selected.start)} step="0.1" value={selected.duration} onChange={(event) => onChange(selected.id, { duration: Math.max(0.1, Math.min(86400 - selected.start, Number(event.target.value) || 0.1)) })} />
          </label>
          <label className={labelClass}>Font size · {selected.fontSize}% of frame height
            <input className="mt-2 w-full accent-moss" type="range" min="2" max="20" step="0.5" value={selected.fontSize} onChange={(event) => onChange(selected.id, { fontSize: Number(event.target.value) })} />
          </label>
          <label className={labelClass}>Horizontal position · {selected.x}%
            <input className="mt-2 w-full accent-moss" type="range" min="0" max="100" step="1" value={selected.x} onChange={(event) => onChange(selected.id, { x: Number(event.target.value) })} />
          </label>
          <label className={labelClass}>Vertical position · {selected.y}%
            <input className="mt-2 w-full accent-moss" type="range" min="0" max="100" step="1" value={selected.y} onChange={(event) => onChange(selected.id, { y: Number(event.target.value) })} />
          </label>
          <label className={labelClass}>Font family
            <select className={fieldClass} value={selected.fontFamily} onChange={(event) => onChange(selected.id, { fontFamily: event.target.value as TitleFontFamily })}>
              <option value="sans-serif">System sans-serif</option>
              <option value="serif">System serif</option>
              <option value="monospace">System monospace</option>
            </select>
          </label>
          <label className={labelClass}>Weight
            <select className={fieldClass} value={selected.fontWeight} onChange={(event) => onChange(selected.id, { fontWeight: Number(event.target.value) as TitleOverlay['fontWeight'] })}>
              <option value="400">Regular</option>
              <option value="700">Bold</option>
            </select>
          </label>
          <label className={labelClass}>Alignment
            <select className={fieldClass} value={selected.align} onChange={(event) => onChange(selected.id, { align: event.target.value as TitleAlignment })}>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </label>
          <label className={labelClass}>Text color
            <input className={`${fieldClass} h-10 p-1`} type="color" value={selected.color} onChange={(event) => onChange(selected.id, { color: event.target.value.toUpperCase() })} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-neutral-600">
            <input type="checkbox" checked={selected.background !== null} onChange={(event) => onChange(selected.id, { background: event.target.checked ? '#000000' : null })} />
            Background
          </label>
          {selected.background !== null && <label className={labelClass}>Background color
            <input className={`${fieldClass} h-10 p-1`} type="color" value={selected.background} onChange={(event) => onChange(selected.id, { background: event.target.value.toUpperCase() })} />
          </label>}
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-neutral-600">
            <input type="checkbox" checked={selected.shadow} onChange={(event) => onChange(selected.id, { shadow: event.target.checked })} />
            Text shadow
          </label>
          <div className="flex items-end md:col-span-2 xl:col-span-3">
            <button type="button" onClick={() => onRemove(selected.id)} className="border border-red-200 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50">Remove title</button>
          </div>
        </div>
      )}
    </section>
  );
}

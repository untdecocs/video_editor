import { useEffect, useRef } from 'react';

type ExportProgressProps = {
  progress: number;
  isExporting: boolean;
  statusMessage: string;
};

export function ExportProgress({ progress, isExporting, statusMessage }: ExportProgressProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="export-title" aria-describedby="export-status">
      <section className="w-full max-w-md border border-white/10 bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-moss">Exporting</p>
            <h2 ref={titleRef} id="export-title" tabIndex={-1} className="text-xl font-semibold text-ink">Creating your video</h2>
          </div>
          <span className="text-2xl tabular-nums text-moss">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden bg-neutral-200" role="progressbar" aria-label="Video export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full bg-moss transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p id="export-status" className="mt-4 text-sm text-neutral-600" role="status">{statusMessage}</p>
        {isExporting && <p className="mt-6 border-t border-neutral-200 pt-4 text-xs text-neutral-400">Keep this tab open while your video is being rendered.</p>}
      </section>
    </div>
  );
}

type ExportProgressProps = {
  progress: number;
  isExporting: boolean;
  statusMessage: string;
};

export function ExportProgress({ progress, isExporting, statusMessage }: ExportProgressProps) {
  return (
    <div className="export-progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="progress-meta">
        <span>{statusMessage}</span>
        <strong>{Math.round(progress)}%</strong>
      </div>
      {isExporting && <span className="visually-hidden">Export in progress</span>}
    </div>
  );
}

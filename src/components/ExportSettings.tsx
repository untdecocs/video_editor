type ExportSettingsProps = {
  format: string;
  resolution: string;
  frameRate: string;
  onFormatChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onFrameRateChange: (value: string) => void;
};

export function ExportSettings({
  format,
  resolution,
  frameRate,
  onFormatChange,
  onResolutionChange,
  onFrameRateChange,
}: ExportSettingsProps) {
  return (
      <div className="settings-grid">
        <label>
          <span>Format</span>
          <select value={format} onChange={(event) => onFormatChange(event.target.value)}>
            <option value="MP4">MP4</option>
            <option value="WebM">WebM</option>
          </select>
        </label>

        <label>
          <span>Resolution</span>
          <select value={resolution} onChange={(event) => onResolutionChange(event.target.value)}>
            <option value="1920x1080">1920 × 1080</option>
            <option value="1280x720">1280 × 720</option>
            <option value="1080x1920">1080 × 1920</option>
            <option value="1080x1080">1080 × 1080</option>
            <option value="Original">Original image ratio</option>
          </select>
        </label>

        <label>
          <span>Frame rate</span>
          <select value={frameRate} onChange={(event) => onFrameRateChange(event.target.value)}>
            <option value="24">24 FPS</option>
            <option value="30">30 FPS</option>
            <option value="60">60 FPS</option>
          </select>
        </label>
      </div>
  );
}

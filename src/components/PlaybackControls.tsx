import { formatDuration } from '../services/media';

type PlaybackControlsProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  onTogglePlayback: () => void;
};

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  progress,
  onTogglePlayback,
}: PlaybackControlsProps) {
  return (
    <div className="playback-panel">
      <button
        type="button"
        className="play-button"
        onClick={onTogglePlayback}
        disabled={duration <= 0}
        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
      >
        <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
      </button>

      <div className="timeline-area">
        <div className="timeline">
          <div className="timeline-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="time-row compact-row">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
}

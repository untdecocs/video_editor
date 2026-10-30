import { useEffect, useRef } from 'react';

type VideoPreviewProps = {
  imagePreview: string | null;
  audioUrl: string | null;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlaybackEnded: () => void;
};

export function VideoPreview({
  imagePreview,
  audioUrl,
  isPlaying,
  onTimeChange,
  onPlaybackEnded,
}: VideoPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      return;
    }

    if (isPlaying) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, [audioUrl, isPlaying]);

  return (
    <div className="preview-container">
      <div className="preview-frame">
        {imagePreview ? (
          <img src={imagePreview} alt="Video background" className="preview-image" />
        ) : (
          <div className="preview-placeholder">
            <span className="placeholder-image" aria-hidden="true">▧</span>
            <strong>Your video preview</strong>
            <span>Add a cover image to see it here</span>
          </div>
        )}
        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime)}
            onEnded={onPlaybackEnded}
          />
        ) : null}
      </div>
    </div>
  );
}

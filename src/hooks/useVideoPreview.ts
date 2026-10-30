import { useEffect, useMemo, useState } from 'react';

export function useVideoPreview(audioDuration: number) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const progress = useMemo(() => {
    if (!audioDuration || audioDuration <= 0) {
      return 0;
    }

    return (currentTime / audioDuration) * 100;
  }, [audioDuration, currentTime]);

  useEffect(() => {
    if (audioDuration > 0 && currentTime > audioDuration) {
      setCurrentTime(audioDuration);
    }
  }, [audioDuration, currentTime]);

  return {
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    progress,
  };
}

import { useMemo } from 'react';
import { formatFileSize } from '../services/media';

export function useAudio(file: File | null) {
  return useMemo(() => {
    const fileName = file?.name ?? 'No audio selected';
    const fileSize = file ? formatFileSize(file.size) : '0 KB';
    const detectedType = file?.type || 'audio';
    const ready = Boolean(file);

    return {
      fileName,
      fileSize,
      detectedType,
      ready,
    };
  }, [file]);
}

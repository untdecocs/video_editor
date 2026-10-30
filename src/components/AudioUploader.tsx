import { useRef } from 'react';
import { formatDuration } from '../services/media';

type AudioUploaderProps = {
  onFileSelect: (file: File) => void;
  fileName: string;
  fileSize: string;
  detectedType: string;
  duration: number;
};

export function AudioUploader({
  onFileSelect,
  fileName,
  fileSize,
  detectedType,
  duration,
}: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    const selectedFile = fileList?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="min-w-0">
      <label
        className={`flex min-h-24 w-full cursor-pointer items-center gap-4 border border-dashed p-5 transition-colors ${duration > 0 ? 'border-moss bg-white' : 'border-neutral-300 bg-white/70 hover:border-moss'}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          id="audio-upload"
          type="file"
          accept=".mp3,.wav,.aac,.m4a,.flac,.ogg,.wma,audio/*"
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span className="grid h-10 w-10 shrink-0 place-items-center bg-lime text-lg text-ink" aria-hidden="true">♫</span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold text-ink">{duration > 0 ? fileName : 'Choose an audio file'}</strong>
          <small className="mt-1 block text-xs text-neutral-500">
            {duration > 0
              ? `${formatDuration(duration)} · ${fileSize} · ${detectedType}`
              : 'MP3, WAV, AAC, M4A, FLAC or OGG'}
          </small>
        </span>
        <span className="text-xs font-semibold text-moss">{duration > 0 ? 'Change' : 'Browse'}</span>
      </label>
    </div>
  );
}

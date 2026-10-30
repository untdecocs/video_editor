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
  };

  return (
    <div className="upload-control">
      <label
        className={`dropzone${duration > 0 ? ' has-file' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.aac,.m4a,.flac,.ogg,.wma,audio/*"
          className="visually-hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span className="upload-icon audio-icon" aria-hidden="true">♫</span>
        <span className="dropzone-copy">
          <strong>{duration > 0 ? fileName : 'Choose an audio file'}</strong>
          <small>
            {duration > 0
              ? `${formatDuration(duration)} · ${fileSize} · ${detectedType}`
              : 'MP3, WAV, AAC, M4A, FLAC or OGG'}
          </small>
        </span>
        <span className="upload-action">{duration > 0 ? 'Change' : 'Browse'}</span>
      </label>
    </div>
  );
}

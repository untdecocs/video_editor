import { useEffect, useState } from 'react';
import { AudioUploader } from './components/AudioUploader';
import { ExportProgress } from './components/ExportProgress';
import { ExportSettings } from './components/ExportSettings';
import { ImageUploader } from './components/ImageUploader';
import { PlaybackControls } from './components/PlaybackControls';
import { VideoPreview } from './components/VideoPreview';
import { useAudio } from './hooks/useAudio';
import { useVideoPreview } from './hooks/useVideoPreview';
import { buildOutputFileName, formatFileSize } from './services/media';
import { getSupportedMimeType, renderVideo } from './services/videoExport';

type LoadedFile = {
  file: File;
  name: string;
  url: string;
  size: string;
  type: string;
  duration: number;
};

const defaultStatus = 'Ready to create a video.';

type ExportFileHandle = {
  name: string;
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type SavePickerOptions = {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
};

declare global {
  interface Window {
    showSaveFilePicker?: (options: SavePickerOptions) => Promise<ExportFileHandle>;
  }
}

function App() {
  const [audioFile, setAudioFile] = useState<LoadedFile | null>(null);
  const [imageFile, setImageFile] = useState<LoadedFile | null>(null);
  const [destinationHandle, setDestinationHandle] = useState<ExportFileHandle | null>(null);
  const [format, setFormat] = useState('MP4');
  const [resolution, setResolution] = useState('1920x1080');
  const [frameRate, setFrameRate] = useState('30');
  const [statusMessage, setStatusMessage] = useState(defaultStatus);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [hasStartedExport, setHasStartedExport] = useState(false);

  const audioMeta = useAudio(audioFile?.file ?? null);
  const { currentTime, setCurrentTime, isPlaying, setIsPlaying, progress } = useVideoPreview(audioFile?.duration ?? 0);

  useEffect(() => {
    return () => {
      if (audioFile?.url) {
        URL.revokeObjectURL(audioFile.url);
      }

      if (imageFile?.url) {
        URL.revokeObjectURL(imageFile.url);
      }
    };
  }, [audioFile, imageFile]);

  const readAudioDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const tempUrl = URL.createObjectURL(file);
      const tempAudio = new Audio();

      tempAudio.preload = 'metadata';
      tempAudio.src = tempUrl;
      tempAudio.onloadedmetadata = () => {
        const duration = Number.isFinite(tempAudio.duration) ? tempAudio.duration : 0;
        URL.revokeObjectURL(tempUrl);
        resolve(duration);
      };
      tempAudio.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        resolve(0);
      };
    });

  const handleAudioSelect = async (file: File) => {
    const duration = await readAudioDuration(file);
    const objectUrl = URL.createObjectURL(file);

    setAudioFile({
      file,
      name: file.name,
      url: objectUrl,
      size: formatFileSize(file.size),
      type: file.type || 'audio',
      duration,
    });
    setDestinationHandle(null);
    setCurrentTime(0);
    setHasStartedExport(false);
    setExportProgress(0);
    setStatusMessage(
      duration > 0
        ? `Loaded ${file.name}. Ready to preview.`
        : `Loaded ${file.name}, but this browser could not read its duration.`,
    );
  };

  const handleImageSelect = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setImageFile({
      file,
      name: file.name,
      url: objectUrl,
      size: formatFileSize(file.size),
      type: file.type || 'image',
      duration: audioFile?.duration ?? 0,
    });
    setHasStartedExport(false);
    setExportProgress(0);
    setStatusMessage(`Loaded ${file.name}. Image is ready.`);
  };

  const handleChooseDestination = async () => {
    if (!window.showSaveFilePicker) {
      setStatusMessage("This browser can't open a save-location picker. Use its Downloads settings to choose the folder.");
      return;
    }

    const extension = format.toLowerCase();
    const mimeType = format === 'MP4' ? 'video/mp4' : 'video/webm';

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: buildOutputFileName(audioFile?.name ?? 'video', extension),
        types: [
          {
            description: `${format} video`,
            accept: { [mimeType]: [`.${extension}`] },
          },
        ],
      });
      setDestinationHandle(handle);
      setStatusMessage(`Export destination selected: ${handle.name}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setStatusMessage(`Could not choose an export destination: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExport = async () => {
    if (!audioFile || !imageFile) {
      setStatusMessage('Add both the audio track and the cover image before exporting.');
      return;
    }

    const mimeType = getSupportedMimeType(format);
    if (!mimeType) {
      setStatusMessage(
        format === 'MP4'
          ? 'MP4 recording is not supported by this browser. Select WebM or use a browser with MP4 MediaRecorder support.'
          : 'Video recording is not supported by this browser.',
      );
      return;
    }

    setIsExporting(true);
    setHasStartedExport(true);
    setExportProgress(0);
    setStatusMessage(`Rendering ${format} video...`);

    try {
      const blob = await renderVideo({
        audioFile: audioFile.file,
        imageFile: imageFile.file,
        resolution,
        frameRate: Number(frameRate),
        mimeType,
        onProgress: (nextProgress) => {
          setExportProgress(Math.min(nextProgress, 100));
          setStatusMessage(`Rendering ${format} video (${Math.round(nextProgress)}%)...`);
        },
      });
      const outputName = buildOutputFileName(audioFile.name, format.toLowerCase());

      if (destinationHandle) {
        const writable = await destinationHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        setStatusMessage(`Export complete: ${destinationHandle.name}`);
      } else {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = outputName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        setStatusMessage(`Export complete: ${outputName}. Check your browser's Downloads folder.`);
      }

      setExportProgress(100);
    } catch (error) {
      setStatusMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const canExport = Boolean(audioFile && imageFile);
  const currentStep = !audioFile ? 1 : !imageFile ? 2 : 3;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Audio to Video home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>stillwave</span>
        </a>
        <div className="topbar-note">
          <span className="status-dot" />
          Your audio, brought to life
        </div>
      </header>

      <main className="app-main">
        <section className="intro">
          <p className="eyebrow">Simple video maker</p>
          <h1>Make a video from your audio.</h1>
          <p>Just add a track, choose a cover, and save your video.</p>
        </section>

        <ol className="stepper" aria-label="Creation steps">
          {[
            { number: 1, title: 'Add audio', complete: Boolean(audioFile) },
            { number: 2, title: 'Add image', complete: Boolean(imageFile) },
            { number: 3, title: 'Export video', complete: exportProgress === 100 },
          ].map((step) => {
            const active = step.number === currentStep;
            return (
              <li
                key={step.number}
                className={`stepper-item${active ? ' is-active' : ''}${step.complete ? ' is-complete' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                <span className="stepper-number">{step.complete ? '✓' : `0${step.number}`}</span>
                <span>{step.title}</span>
              </li>
            );
          })}
        </ol>

        <div className="workspace-grid">
          <div className="workflow-column">
            <section className={`step-card${currentStep === 1 ? ' step-card-active' : ''}`}>
              <div className="step-card-heading">
                <span className="step-number">01</span>
                <div>
                  <h2>Your audio</h2>
                  <p>The soundtrack for your video</p>
                </div>
                <span className={`step-status${audioFile ? ' status-done' : ''}`}>
                  {audioFile ? 'Added' : 'Required'}
                </span>
              </div>
              <AudioUploader
                onFileSelect={handleAudioSelect}
                fileName={audioMeta.fileName}
                fileSize={audioMeta.fileSize}
                detectedType={audioMeta.detectedType}
                duration={audioFile?.duration ?? 0}
              />
            </section>

            <section className={`step-card${currentStep === 2 ? ' step-card-active' : ''}`}>
              <div className="step-card-heading">
                <span className="step-number">02</span>
                <div>
                  <h2>Cover image</h2>
                  <p>One image, shown throughout</p>
                </div>
                <span className={`step-status${imageFile ? ' status-done' : ''}`}>
                  {imageFile ? 'Added' : 'Required'}
                </span>
              </div>
              <ImageUploader
                onFileSelect={handleImageSelect}
                imageName={imageFile?.name ?? ''}
                imagePreview={imageFile?.url ?? null}
              />
            </section>

            <section className={`step-card${currentStep === 3 ? ' step-card-active' : ''}`}>
              <div className="step-card-heading">
                <span className="step-number">03</span>
                <div>
                  <h2>Export video</h2>
                  <p>Choose quality and save location</p>
                </div>
              </div>
              <ExportSettings
                format={format}
                resolution={resolution}
                frameRate={frameRate}
                onFormatChange={(value) => {
                  setFormat(value);
                  setDestinationHandle(null);
                }}
                onResolutionChange={setResolution}
                onFrameRateChange={setFrameRate}
              />
              <div className="destination-row">
                <div className="destination-copy">
                  <span className="destination-label">Save to</span>
                  <strong>{destinationHandle?.name ?? 'Downloads folder'}</strong>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={handleChooseDestination}
                  disabled={isExporting}
                >
                  Choose location
                </button>
              </div>
              {!hasStartedExport && statusMessage !== defaultStatus && (
                <p className="inline-status" role="status">{statusMessage}</p>
              )}
              {!canExport && (
                <p className="helper-text">
                  Add an audio track and cover image to continue.
                </p>
              )}
              {hasStartedExport && (
                <ExportProgress
                  progress={exportProgress}
                  isExporting={isExporting}
                  statusMessage={statusMessage}
                />
              )}
              <button
                type="button"
                className="primary-button export-button"
                onClick={handleExport}
                disabled={!canExport || isExporting}
              >
                <span>{isExporting ? 'Creating your video…' : 'Create video'}</span>
                {!isExporting && <span aria-hidden="true">→</span>}
              </button>
            </section>
          </div>

          <section className="preview-card" aria-label="Video preview">
            <div className="preview-title">
              <div>
                <h2>Preview</h2>
                <p>This is how your video will look</p>
              </div>
              <span className="aspect-tag">16:9</span>
            </div>
          <VideoPreview
            imagePreview={imageFile?.url ?? null}
            audioUrl={audioFile?.url ?? null}
            isPlaying={isPlaying}
            onTimeChange={setCurrentTime}
            onPlaybackEnded={() => setIsPlaying(false)}
          />
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={audioFile?.duration ?? 0}
            progress={progress}
            onTogglePlayback={() => setIsPlaying((current) => !current)}
          />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;

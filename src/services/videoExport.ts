type ExportOptions = {
  audioFile: File;
  imageFile: File;
  resolution: string;
  frameRate: number;
  mimeType: string;
  onProgress: (progress: number) => void;
};

export function getSupportedMimeType(format: string): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  const candidates =
    format === 'MP4'
      ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
}

function getCanvasSize(resolution: string, imageWidth: number, imageHeight: number) {
  const [width, height] = resolution.split('x').map(Number);
  const dimensions =
    Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? [width, height]
      : [imageWidth, imageHeight];

  return dimensions.map((dimension) => Math.max(2, Math.round(dimension / 2) * 2));
}

export async function renderVideo({
  audioFile,
  imageFile,
  resolution,
  frameRate,
  mimeType,
  onProgress,
}: ExportOptions): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video export is not supported in this browser.');
  }

  const audioUrl = URL.createObjectURL(audioFile);
  const imageUrl = URL.createObjectURL(imageFile);
  const audio = new Audio(audioUrl);
  const image = new Image();
  let audioContext: AudioContext | null = null;
  let canvasStream: MediaStream | null = null;
  let animationFrame = 0;

  try {
    audio.preload = 'auto';
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error('The selected audio could not be decoded by this browser.'));
      audio.load();
    });

    image.src = imageUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = getCanvasSize(resolution, image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d');

    if (!context || typeof canvas.captureStream !== 'function') {
      throw new Error('Canvas video capture is not supported in this browser.');
    }

    audioContext = new AudioContext();
    const audioSource = audioContext.createMediaElementSource(audio);
    const audioDestination = audioContext.createMediaStreamDestination();
    audioSource.connect(audioDestination);
    await audioContext.resume();

    canvasStream = canvas.captureStream(frameRate);
    const outputStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(outputStream, { mimeType });
    const chunks: Blob[] = [];

    const drawFrame = () => {
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      context.drawImage(
        image,
        (canvas.width - drawWidth) / 2,
        (canvas.height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      animationFrame = window.requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return await new Promise<Blob>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        if (error) {
          reject(error);
          return;
        }

        resolve(new Blob(chunks, { type: mimeType }));
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => finish(new Error('The browser encountered an error while recording the video.'));
      recorder.onstop = () => finish();
      audio.ontimeupdate = () => {
        onProgress(audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0);
      };
      audio.onended = () => {
        onProgress(100);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

      try {
        recorder.start(1000);
        void audio.play().catch(() => {
          finish(new Error('The audio could not be played for export.'));
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        });
      } catch (error) {
        finish(error instanceof Error ? error : new Error('The video recorder could not be started.'));
      }
    });
  } finally {
    window.cancelAnimationFrame(animationFrame);
    audio.pause();
    canvasStream?.getTracks().forEach((track) => track.stop());
    audioContext?.close();
    URL.revokeObjectURL(audioUrl);
    URL.revokeObjectURL(imageUrl);
  }
}

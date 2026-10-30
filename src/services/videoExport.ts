import type { TimelineAsset, TimelineClip } from './timeline';
import { getClipDuration } from './timeline';

type ExportOptions = {
  audioFile: File;
  assets: TimelineAsset[];
  clips: TimelineClip[];
  width: number;
  height: number;
  frameRate: number;
  mimeType: string;
  onProgress: (progress: number) => void;
};

type VisualElement = HTMLImageElement | HTMLVideoElement;

type LocatedClip = { clip: TimelineClip; elapsed: number; offset: number };

export function getSupportedMimeType(format: string): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = format === 'MP4'
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
}

function locateClip(clips: TimelineClip[], time: number): LocatedClip | null {
  let offset = 0;
  for (const clip of clips) {
    const duration = getClipDuration(clip);
    if (time < offset + duration) return { clip, elapsed: time - offset, offset };
    offset += duration;
  }
  const clip = clips[clips.length - 1];
  return clip ? { clip, elapsed: getClipDuration(clip), offset: Math.max(0, offset - getClipDuration(clip)) } : null;
}

function drawVisual(
  context: CanvasRenderingContext2D,
  visual: VisualElement,
  clip: TimelineClip,
  width: number,
  height: number,
  alpha = 1,
) {
  const sourceWidth = visual instanceof HTMLVideoElement ? visual.videoWidth : visual.naturalWidth;
  const sourceHeight = visual instanceof HTMLVideoElement ? visual.videoHeight : visual.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;

  const rotation = (clip.transform.rotation * Math.PI) / 180;
  const quarterTurn = Math.abs(clip.transform.rotation % 180) === 90;
  const orientedWidth = quarterTurn ? sourceHeight : sourceWidth;
  const orientedHeight = quarterTurn ? sourceWidth : sourceHeight;
  const fitScale = clip.transform.fit === 'cover'
    ? Math.max(width / orientedWidth, height / orientedHeight)
    : Math.min(width / orientedWidth, height / orientedHeight);

  context.save();
  context.globalAlpha = alpha;
  context.translate(width / 2 + (clip.transform.x / 100) * width, height / 2 + (clip.transform.y / 100) * height);
  context.rotate(rotation);
  context.scale(
    fitScale * clip.transform.zoom * (clip.transform.flipX ? -1 : 1),
    fitScale * clip.transform.zoom * (clip.transform.flipY ? -1 : 1),
  );
  context.drawImage(visual, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
  context.restore();
}

function seekVideo(video: HTMLVideoElement, time: number) {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
  const safeTime = Math.max(0, Math.min(time, video.duration || time));
  if (Math.abs(video.currentTime - safeTime) > 0.12) {
    try { video.currentTime = safeTime; } catch { /* Safari may reject a seek until metadata is ready. */ }
  }
}

export async function renderVideo({
  audioFile,
  assets,
  clips,
  width,
  height,
  frameRate,
  mimeType,
  onProgress,
}: ExportOptions): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') throw new Error('Video export is not supported in this browser.');
  if (!clips.length) throw new Error('Add at least one visual clip before exporting.');

  const audioUrl = URL.createObjectURL(audioFile);
  const audio = new Audio();
  audio.preload = 'auto';
  let audioContext: AudioContext | null = null;
  let canvasStream: MediaStream | null = null;
  let animationFrame = 0;
  const visuals = new Map<string, VisualElement>();

  try {
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audio);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    await audioContext.resume();

    const audioDuration = await new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Timed out while loading the soundtrack.')), 15000);
      audio.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          reject(new Error('The soundtrack has no readable duration.'));
        } else resolve(audio.duration);
      };
      audio.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('The selected audio could not be decoded by this browser. Try a standard MP3 or WAV file.'));
      };
      audio.src = audioUrl;
    });

    await Promise.all(assets.map(async (asset) => {
      if (asset.kind === 'image') {
        const image = new Image();
        image.src = asset.url;
        await image.decode();
        visuals.set(asset.id, image);
      } else {
        const video = document.createElement('video');
        video.src = asset.url;
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error(`Could not decode video clip: ${asset.file.name}`));
          video.load();
        });
        visuals.set(asset.id, video);
      }
    }));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.captureStream !== 'function') {
      throw new Error('Canvas video capture is not supported in this browser.');
    }

    canvasStream = canvas.captureStream(frameRate);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const drawAtTime = (time: number) => {
      context.fillStyle = '#000';
      context.fillRect(0, 0, width, height);
      const current = locateClip(clips, time);
      if (!current) return;
      const visual = visuals.get(current.clip.assetId);
      if (visual instanceof HTMLVideoElement) seekVideo(visual, current.clip.start + current.elapsed);

      const transitionDuration = 0.4;
      const transitionProgress = current.clip.transition === 'fade'
        ? Math.min(1, current.elapsed / transitionDuration)
        : 1;
      if (current.clip.transition === 'fade' && current.elapsed < transitionDuration && current.offset > 0) {
        const previous = locateClip(clips, Math.max(0, current.offset - 0.01));
        const previousVisual = previous ? visuals.get(previous.clip.assetId) : undefined;
        if (previous && previousVisual) {
          if (previousVisual instanceof HTMLVideoElement) seekVideo(previousVisual, previous.clip.start + previous.elapsed);
          drawVisual(context, previousVisual, previous.clip, width, height, 1 - transitionProgress);
        }
      }
      if (visual) drawVisual(context, visual, current.clip, width, height, transitionProgress);
    };

    const drawFrame = () => {
      drawAtTime(audio.currentTime);
      onProgress(Math.min(99, (audio.currentTime / audioDuration) * 100));
      animationFrame = window.requestAnimationFrame(drawFrame);
    };

    drawAtTime(0);
    return await new Promise<Blob>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(new Blob(chunks, { type: mimeType }));
      };

      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => finish(new Error('The browser encountered an error while recording. Try another export format.'));
      recorder.onstop = () => finish();
      audio.onended = () => {
        onProgress(100);
        if (recorder.state !== 'inactive') recorder.stop();
      };

      try {
        recorder.start(1000);
        animationFrame = window.requestAnimationFrame(drawFrame);
        void audio.play().catch(() => {
          finish(new Error('The browser could not start soundtrack playback for export.'));
          if (recorder.state !== 'inactive') recorder.stop();
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
    visuals.forEach((visual) => {
      if (visual instanceof HTMLVideoElement) {
        visual.pause();
        visual.removeAttribute('src');
        visual.load();
      }
    });
    URL.revokeObjectURL(audioUrl);
  }
}

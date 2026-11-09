import type { TimelineAsset, TimelineClip, TimelineTrack } from './timeline';
import { getActiveClips, getClipDuration, getClipSourceTime, getPreviousClipOnTrack } from './timeline';
import { getActiveTitles, mapTitleToOutput, type TitleOverlay } from './titleOverlay';
import { waitForImageDecode } from './imageMetadata';

type ExportOptions = {
  audioFile: File;
  assets: TimelineAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  titles: TitleOverlay[];
  width: number;
  height: number;
  frameRate: number;
  mimeType: string;
  onProgress: (progress: number) => void;
  onStatus: (status: string) => void;
  signal: AbortSignal;
};

type VisualElement = HTMLImageElement | HTMLVideoElement;

function abortError() {
  return new DOMException('Video export was canceled.', 'AbortError');
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortError();
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function waitForVideoData(video: HTMLVideoElement, fileName: string, signal: AbortSignal): Promise<void> {
  const load = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out while loading video clip: ${fileName}`));
    }, 15_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('error', onError);
    };
    const onLoadedData = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Could not decode video clip: ${fileName}`));
    };
    video.addEventListener('loadeddata', onLoadedData, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.load();
  });
  return raceWithAbort(load, signal);
}

function waitForOutputMedia(
  media: HTMLMediaElement,
  sourceUrl: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const eventName = media instanceof HTMLVideoElement ? 'loadeddata' : 'loadedmetadata';
    const timeout = window.setTimeout(() => finish(new Error('Timed out while validating the exported video.')), 15_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      media.removeEventListener(eventName, onReady);
      media.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => {
      if (!Number.isFinite(media.duration) || media.duration <= 0) {
        finish(new Error('The exported video has no valid duration.'));
        return;
      }
      finish();
    };
    const onError = () => finish(new Error('The browser could not decode the exported video and soundtrack.'));
    const onAbort = () => finish(abortError());

    media.addEventListener(eventName, onReady, { once: true });
    media.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    media.src = sourceUrl;
    media.load();
  });
}

async function validateOutput(blob: Blob, width: number, height: number, signal: AbortSignal) {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  const audio = new Audio();
  video.preload = 'auto';
  video.muted = true;
  audio.preload = 'metadata';
  try {
    await waitForOutputMedia(video, url, signal);
    await waitForOutputMedia(audio, url, signal);
    if (video.videoWidth !== width || video.videoHeight !== height) {
      throw new Error(`The exported video dimensions do not match the selected ${width} × ${height} canvas.`);
    }
  } finally {
    [video, audio].forEach((media) => {
      media.pause();
      media.removeAttribute('src');
      media.load();
    });
    URL.revokeObjectURL(url);
  }
}

export function getSupportedMimeType(format: string): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = format === 'MP4'
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
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

function drawTitle(context: CanvasRenderingContext2D, title: TitleOverlay, width: number, height: number) {
  const mapped = mapTitleToOutput(title, width, height);
  const fontSize = mapped.fontSize;
  const lineHeight = fontSize * 1.15;
  const maxLineWidth = width * 0.9;
  context.save();
  context.font = `${title.fontWeight} ${fontSize}px ${mapped.fontFamily}`;
  context.textAlign = title.align;
  context.textBaseline = 'middle';

  const lines: string[] = [];
  for (const paragraph of title.text.split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxLineWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }

  const lineWidths = lines.map((line) => context.measureText(line).width);
  const maxTextWidth = Math.max(0, ...lineWidths);
  const padding = fontSize * 0.3;
  const textBlockHeight = lineHeight * lines.length;
  const left = mapped.x - maxTextWidth / 2;
  if (title.background) {
    context.fillStyle = title.background;
    context.fillRect(left - padding, mapped.y - textBlockHeight / 2 - padding, maxTextWidth + padding * 2, textBlockHeight + padding * 2);
  }
  context.fillStyle = title.color;
  context.shadowColor = title.shadow ? 'rgba(0,0,0,.8)' : 'transparent';
  context.shadowBlur = title.shadow ? fontSize * 0.3 : 0;
  context.shadowOffsetY = title.shadow ? fontSize * 0.1 : 0;
  lines.forEach((line, index) => {
    const lineWidth = lineWidths[index];
    const lineX = title.align === 'left'
      ? left
      : title.align === 'right'
        ? left + maxTextWidth - lineWidth
        : left + (maxTextWidth - lineWidth) / 2;
    context.fillText(line, lineX, mapped.y + (index - (lines.length - 1) / 2) * lineHeight, maxLineWidth);
  });
  context.restore();
}

export async function renderVideo({
  audioFile,
  assets,
  tracks,
  clips,
  titles,
  width,
  height,
  frameRate,
  mimeType,
  onProgress,
  onStatus,
  signal,
}: ExportOptions): Promise<Blob> {
  throwIfAborted(signal);
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
    onStatus('Preparing soundtrack…');
    audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audio);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    await raceWithAbort(audioContext.resume(), signal);

    const audioDuration = await raceWithAbort(new Promise<number>((resolve, reject) => {
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
      audio.load();
    }), signal);

    onStatus('Loading visual media…');
    let loadedAssets = 0;
    await Promise.all(assets.map(async (asset) => {
      throwIfAborted(signal);
      if (asset.kind === 'image') {
        const image = new Image();
        visuals.set(asset.id, image);
        await raceWithAbort(waitForImageDecode(image, asset.url), signal);
      } else {
        const video = document.createElement('video');
        visuals.set(asset.id, video);
        video.src = asset.url;
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        await waitForVideoData(video, asset.file.name, signal);
      }
      loadedAssets += 1;
      onStatus(`Loaded visual media · ${loadedAssets}/${assets.length}`);
    }));
    throwIfAborted(signal);

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
      const active = getActiveClips(tracks, clips, time);
      for (const { clip, elapsed } of active) {
        const visual = visuals.get(clip.assetId);
        if (!visual) continue;
        if (visual instanceof HTMLVideoElement) seekVideo(visual, getClipSourceTime(clip, time));
        const transitionProgress = clip.transition === 'fade' ? Math.min(1, elapsed / 0.4) : 1;
        const earlierActiveOnTrack = active.some((item) => item.clip.trackId === clip.trackId
          && item.clip.id !== clip.id
          && item.clip.timelinePosition < clip.timelinePosition);
        if (clip.transition === 'fade' && elapsed < 0.4 && !earlierActiveOnTrack) {
          const previousClip = getPreviousClipOnTrack(clips, clip.trackId, clip.timelinePosition);
          const previousVisual = previousClip ? visuals.get(previousClip.assetId) : undefined;
          if (previousClip && previousVisual) {
            if (previousVisual instanceof HTMLVideoElement) {
              seekVideo(previousVisual, getClipSourceTime(previousClip, previousClip.timelinePosition + getClipDuration(previousClip)));
            }
            drawVisual(context, previousVisual, previousClip, width, height, 1 - transitionProgress);
          }
        }
        drawVisual(context, visual, clip, width, height, transitionProgress);
      }
      getActiveTitles(titles, time).forEach((title) => drawTitle(context, title, width, height));
    };

    const drawFrame = () => {
      drawAtTime(audio.currentTime);
      onProgress(Math.min(99, (audio.currentTime / audioDuration) * 100));
      animationFrame = window.requestAnimationFrame(drawFrame);
    };

    drawAtTime(0);
    onStatus('Rendering video…');
    const blob = await new Promise<Blob>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else {
          onStatus('Finalizing video…');
          const blob = new Blob(chunks, { type: mimeType });
          if (!blob.size) {
            reject(new Error('The browser produced an empty video file. Try another export format or browser.'));
          } else {
            resolve(blob);
          }
        }
      };
      const onAbort = () => {
        finish(abortError());
        if (recorder.state !== 'inactive') recorder.stop();
      };

      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => finish(new Error('The browser encountered an error while recording. Try another export format.'));
      recorder.onstop = () => finish();
      audio.onended = () => {
        onProgress(100);
        if (recorder.state !== 'inactive') {
          try { recorder.requestData(); } catch { /* stop() still flushes the final recording data */ }
          recorder.stop();
        }
      };

      try {
        recorder.start(Math.min(1000, Math.max(50, audioDuration * 250)));
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) {
          onAbort();
          return;
        }
        animationFrame = window.requestAnimationFrame(drawFrame);
        void audio.play().catch(() => {
          finish(new Error('The browser could not start soundtrack playback for export.'));
          if (recorder.state !== 'inactive') recorder.stop();
        });
      } catch (error) {
        finish(error instanceof Error ? error : new Error('The video recorder could not be started.'));
      }
    });
    onStatus('Validating video and soundtrack…');
    await validateOutput(blob, width, height, signal);
    return blob;
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

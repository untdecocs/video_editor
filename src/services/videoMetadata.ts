export interface VideoMetadataElement {
  duration: number;
  src: string;
  addEventListener(type: 'loadedmetadata' | 'error', listener: EventListener): void;
  removeEventListener(type: 'loadedmetadata' | 'error', listener: EventListener): void;
  removeAttribute(name: string): void;
  load(): void;
}

/**
 * Wait for readable video metadata, bounding imports when a browser never emits
 * either metadata or an error event (for example, for an unsupported codec).
 */
export function waitForVideoMetadata(
  video: VideoMetadataElement,
  sourceUrl: string,
  timeoutMs = 12_000,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };
    const teardownSource = () => {
      try {
        video.removeAttribute('src');
        video.load();
      } catch {
        // The source is still considered failed; teardown is best-effort.
      }
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      teardownSource();
      reject(new Error(message));
    };
    const onLoadedMetadata: EventListener = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        fail('The browser did not provide a valid video duration.');
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration);
    };
    const onError: EventListener = () => {
      fail('The browser could not decode this video.');
    };

    timeout = setTimeout(() => {
      fail('Timed out while reading video metadata.');
    }, timeoutMs);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
    try {
      video.src = sourceUrl;
    } catch {
      fail('The browser could not open this video.');
    }
  });
}

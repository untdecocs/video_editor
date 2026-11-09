export interface AudioMetadataElement {
  duration: number;
  src: string;
  addEventListener(type: 'loadedmetadata' | 'error', listener: EventListener): void;
  removeEventListener(type: 'loadedmetadata' | 'error', listener: EventListener): void;
  removeAttribute(name: string): void;
  load(): void;
}

/**
 * Wait for readable audio metadata, bounding imports when a browser never emits
 * either metadata or an error event.
 */
export function waitForAudioMetadata(
  audio: AudioMetadataElement,
  sourceUrl: string,
  timeoutMs = 12_000,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
    };
    const teardownSource = () => {
      try {
        audio.removeAttribute('src');
        audio.load();
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
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        fail('The browser did not provide a valid audio duration.');
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration);
    };
    const onError: EventListener = () => {
      fail('The browser could not decode this audio.');
    };

    timeout = setTimeout(() => {
      fail('Timed out while reading audio metadata.');
    }, timeoutMs);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    try {
      audio.src = sourceUrl;
      audio.load();
    } catch {
      fail('The browser could not open this audio.');
    }
  });
}

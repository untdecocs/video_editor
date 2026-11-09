export interface ImageDecodeElement {
  src: string;
  decode(): Promise<void>;
}

export function waitForImageDecode(
  image: ImageDecodeElement,
  sourceUrl: string,
  timeoutMs = 12_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timed out while decoding the image.'));
    }, timeoutMs);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };

    try {
      image.src = sourceUrl;
      void image.decode().then(
        () => finish(),
        () => finish(new Error('The browser could not decode this image.')),
      );
    } catch {
      finish(new Error('The browser could not open this image.'));
    }
  });
}

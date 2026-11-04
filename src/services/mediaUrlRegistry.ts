export interface ObjectUrlApi {
  createObjectURL(value: Blob | MediaSource): string;
  revokeObjectURL(url: string): void;
}

/** Tracks editor-owned Blob URLs so replacements, removals, and teardown revoke them once. */
export class MediaUrlRegistry {
  private readonly urls = new Set<string>();
  private readonly api: ObjectUrlApi;

  constructor(api: ObjectUrlApi = URL) {
    this.api = api;
  }

  create(value: Blob | MediaSource): string {
    const url = this.api.createObjectURL(value);
    this.urls.add(url);
    return url;
  }

  track(url: string): void {
    this.urls.add(url);
  }

  revoke(url: string): void {
    if (!this.urls.delete(url)) return;
    this.api.revokeObjectURL(url);
  }

  /** Revoke the prior project URLs while retaining the already-created replacement URLs. */
  replace(urls: Iterable<string>): void {
    const retained = new Set(urls);
    for (const url of this.urls) {
      if (!retained.has(url)) this.api.revokeObjectURL(url);
    }
    this.urls.clear();
    retained.forEach((url) => this.urls.add(url));
  }

  clear(): void {
    this.replace([]);
  }
}

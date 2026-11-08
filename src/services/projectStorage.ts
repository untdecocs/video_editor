import { validateProjectDocument, type ProjectDocument } from './project.ts';

const DATABASE_NAME = 'stillwave-projects';
const DATABASE_VERSION = 1;
const STORE_NAME = 'projects';

export type ProjectMediaBlobs = {
  audio: Blob | null;
  assets: Record<string, Blob>;
};

export type StoredProject = {
  document: ProjectDocument;
  media: ProjectMediaBlobs;
};

export type ProjectSummary = Pick<ProjectDocument, 'id' | 'name' | 'createdAt' | 'updatedAt'> & {
  problem?: string;
};

export class ProjectStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectStorageError';
  }
}

/** Small seam that keeps the storage behavior testable without a browser. */
export interface ProjectRecordBackend {
  list(): Promise<unknown[]>;
  get(id: string): Promise<unknown | undefined>;
  put(id: string, value: unknown): Promise<void>;
  add(id: string, value: unknown): Promise<void>;
  delete(id: string): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertBlob(value: unknown, path: string, expectedSize: number): asserts value is Blob {
  if (typeof Blob === 'undefined' || !(value instanceof Blob)) {
    throw new ProjectStorageError(`Stored media "${path}" is missing or unreadable. Re-import the original file.`);
  }
  if (value.size !== expectedSize) {
    throw new ProjectStorageError(`Stored media "${path}" is incomplete or corrupted. Re-import the original file.`);
  }
}

function validateStoredProject(value: unknown): StoredProject {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'document' && key !== 'media')) {
    throw new ProjectStorageError('This saved project record is malformed and cannot be opened.');
  }

  let document: ProjectDocument;
  try {
    document = validateProjectDocument(value.document);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ProjectStorageError(`This saved project is malformed and cannot be opened: ${detail}`);
  }

  const media = value.media;
  if (!isRecord(media) || Object.keys(media).some((key) => key !== 'audio' && key !== 'assets')) {
    throw new ProjectStorageError('This saved project has a malformed media collection and cannot be opened.');
  }
  if (!isRecord(media.assets)) {
    throw new ProjectStorageError('This saved project has a malformed visual-media collection and cannot be opened.');
  }

  const audioBlob = media.audio;
  if (document.audio) assertBlob(audioBlob, document.audio.fileName, document.audio.size);
  else if (audioBlob !== null) {
    throw new ProjectStorageError('This saved project has unexpected audio data and cannot be opened.');
  }

  const assetBlobs: Record<string, Blob> = {};
  for (const asset of document.assets) {
    const blob = media.assets[asset.id];
    assertBlob(blob, asset.fileName, asset.size);
    assetBlobs[asset.id] = blob;
  }
  if (Object.keys(media.assets).some((id) => !document.assets.some((asset) => asset.id === id))) {
    throw new ProjectStorageError('This saved project contains unexpected visual media and cannot be opened.');
  }

  return {
    document,
    media: { audio: document.audio ? audioBlob as Blob : null, assets: assetBlobs },
  };
}

function validateForStorage(documentValue: ProjectDocument, media: ProjectMediaBlobs): StoredProject {
  const document = validateProjectDocument(documentValue);
  if (!isRecord(media) || !isRecord(media.assets)) {
    throw new ProjectStorageError('Project media could not be saved because its data is malformed.');
  }
  if (document.audio) assertBlob(media.audio, document.audio.fileName, document.audio.size);
  else if (media.audio !== null) {
    throw new ProjectStorageError('Project audio changed before saving. Retry the save.');
  }
  const assetBlobs: Record<string, Blob> = {};
  for (const asset of document.assets) {
    const blob = media.assets[asset.id];
    assertBlob(blob, asset.fileName, asset.size);
    assetBlobs[asset.id] = blob;
  }
  if (Object.keys(media.assets).some((id) => !document.assets.some((asset) => asset.id === id))) {
    throw new ProjectStorageError('Project media contains unexpected visual data.');
  }
  return {
    document,
    media: { audio: document.audio ? media.audio as Blob : null, assets: assetBlobs },
  };
}

function storageFailure(error: unknown): ProjectStorageError {
  if (error instanceof ProjectStorageError) return error;
  const detail = error instanceof Error ? error.message : String(error);
  const name = isRecord(error) && typeof error.name === 'string' ? error.name : '';
  if (name === 'QuotaExceededError') {
    return new ProjectStorageError(
      'Browser storage is full. Free space or delete an old saved project, then retry. Your current edits are still open.',
    );
  }
  if (name === 'ConstraintError') {
    return new ProjectStorageError('A saved project already uses this new ID. Retry the import; your current edits are still open.');
  }
  return new ProjectStorageError(
    `Could not access browser project storage${detail ? ` (${detail})` : ''}. Check browser storage permissions and retry. Your current edits are still open.`,
  );
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

class IndexedDbProjectBackend implements ProjectRecordBackend {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory | undefined;

  constructor(factory: IDBFactory | undefined) {
    this.factory = factory;
  }

  private database(): Promise<IDBDatabase> {
    if (!this.factory) {
      return Promise.reject(new ProjectStorageError(
        'Browser project storage is unavailable in this browser or context. Keep this tab open and try again in a supported browser.',
      ));
    }
    if (!this.databasePromise) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try {
          request = this.factory!.open(DATABASE_NAME, DATABASE_VERSION);
        } catch (error) {
          reject(error);
          return;
        }
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
        request.onblocked = () => reject(new Error('Browser storage upgrade is blocked by another open editor tab'));
      }).catch((error: unknown): never => {
        this.databasePromise = null;
        throw error;
      });
      this.databasePromise = opening;
    }
    return this.databasePromise!;
  }

  async list(): Promise<unknown[]> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const done = transactionDone(transaction);
    const result = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    await done;
    return result;
  }

  async get(id: string): Promise<unknown | undefined> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const done = transactionDone(transaction);
    const result = await requestResult(transaction.objectStore(STORE_NAME).get(id));
    await done;
    return result;
  }

  async put(id: string, value: unknown): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).put(value, id);
    await done;
  }

  async add(id: string, value: unknown): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).add(value, id);
    await done;
  }

  async delete(id: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).delete(id);
    await done;
  }
}

function getIndexedDbFactory(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB;
  } catch {
    return undefined;
  }
}

export function createProjectStorage(
  backend: ProjectRecordBackend = new IndexedDbProjectBackend(getIndexedDbFactory()),
) {
  const safely = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      throw storageFailure(error);
    }
  };

  return {
    async listProjects(): Promise<ProjectSummary[]> {
      return safely(async () => {
        const projects: ProjectSummary[] = [];
        for (const value of await backend.list()) {
          try {
            const { document } = validateStoredProject(value);
            projects.push({
              id: document.id,
              name: document.name,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            });
          } catch (error) {
            const rawDocument = isRecord(value) && isRecord(value.document) ? value.document : null;
            if (!rawDocument || typeof rawDocument.id !== 'string' || !rawDocument.id.trim()) continue;
            projects.push({
              id: rawDocument.id,
              name: typeof rawDocument.name === 'string' && rawDocument.name.trim()
                ? rawDocument.name
                : 'Unreadable saved project',
              createdAt: typeof rawDocument.createdAt === 'string'
                ? rawDocument.createdAt
                : '1970-01-01T00:00:00.000Z',
              updatedAt: typeof rawDocument.updatedAt === 'string'
                ? rawDocument.updatedAt
                : '1970-01-01T00:00:00.000Z',
              problem: error instanceof Error ? error.message : 'Saved project data is malformed.',
            });
          }
        }
        return projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      });
    },

    async loadProject(id: string): Promise<StoredProject> {
      return safely(async () => {
        const value = await backend.get(id);
        if (value === undefined) {
          throw new ProjectStorageError('This saved project is no longer available. Refresh the project list and try another project.');
        }
        const stored = validateStoredProject(value);
        if (stored.document.id !== id) {
          throw new ProjectStorageError('This saved project has an inconsistent ID and cannot be opened.');
        }
        return stored;
      });
    },

    async saveProject(documentValue: ProjectDocument, media: ProjectMediaBlobs): Promise<void> {
      return safely(async () => {
        const stored = validateForStorage(documentValue, media);
        await backend.put(stored.document.id, stored);
      });
    },

    async saveProjectAsNew(documentValue: ProjectDocument, media: ProjectMediaBlobs): Promise<void> {
      return safely(async () => {
        const stored = validateForStorage(documentValue, media);
        await backend.add(stored.document.id, stored);
      });
    },

    async deleteProject(id: string): Promise<void> {
      return safely(() => backend.delete(id));
    },
  };
}

export const projectStorage = createProjectStorage();

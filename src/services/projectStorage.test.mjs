import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectStorage, ProjectStorageError } from './projectStorage.ts';
import { defaultTransform } from './timeline.ts';

class MemoryBackend {
  records = new Map();

  async list() { return [...this.records.values()]; }
  async get(id) { return this.records.get(id); }
  async put(id, value) { this.records.set(id, structuredClone(value)); }
  async add(id, value) {
    if (this.records.has(id)) {
      const error = new Error('Key already exists');
      error.name = 'ConstraintError';
      throw error;
    }
    this.records.set(id, structuredClone(value));
  }
  async delete(id) { this.records.delete(id); }
}

function project() {
  return {
    id: 'local-project',
    name: 'Recovery cut',
    createdAt: '2026-11-02T12:00:00.000Z',
    updatedAt: '2026-11-02T12:05:00.000Z',
    schemaVersion: 6,
    audioAssets: [{ id: 'audio-1', fileName: 'track.wav', mimeType: 'audio/wav', size: 4, duration: 12 }],
    audioTracks: [{ id: 'audio-track-1', name: 'Audio 1', order: 0, visible: true, locked: false }],
    audioClips: [{ id: 'audio-clip-1', assetId: 'audio-1', trackId: 'audio-track-1', timelinePosition: 0, start: 0, end: 12, volume: 1 }],
    assets: [{
      id: 'visual-1',
      fileName: 'still.png',
      mimeType: 'image/png',
      size: 5,
      kind: 'image',
      duration: 5,
    }],
    tracks: [{ id: 'track-video-1', name: 'Video 1', order: 0, visible: true, locked: false }],
    clips: [{
      id: 'clip-1',
      assetId: 'visual-1',
      trackId: 'track-video-1',
      timelinePosition: 0,
      start: 0,
      end: 0,
      stillDuration: 7,
      stillDurationMode: 'custom',
      transition: 'fade',
      transform: { ...defaultTransform, rotation: 90 },
    }],
    titleOverlays: [],
    markers: [{ id: 'marker-1', time: 4.5, label: 'Saved point' }],
    outputSettings: { presetId: 'custom', customWidth: 720, customHeight: 1280, frameRate: 30, format: 'WebM' },
  };
}

function media() {
  return {
    audioAssets: { 'audio-1': new Blob(['1234'], { type: 'audio/wav' }) },
    assets: { 'visual-1': new Blob(['12345'], { type: 'image/png' }) },
  };
}

test('persists validated project metadata and source Blobs, then restores edits', async () => {
  const backend = new MemoryBackend();
  const storage = createProjectStorage(backend);
  const document = project();
  await storage.saveProject(document, media());

  assert.deepEqual(await storage.listProjects(), [{
    id: document.id,
    name: document.name,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }]);
  const restored = await storage.loadProject(document.id);
  assert.deepEqual(restored.document, document);
  assert.equal(await restored.media.audioAssets['audio-1'].text(), '1234');
  assert.equal(await restored.media.assets['visual-1'].text(), '12345');
});

test('rejects missing or truncated blobs without overwriting the existing record', async () => {
  const backend = new MemoryBackend();
  const storage = createProjectStorage(backend);
  const original = project();
  await storage.saveProject(original, media());

  await assert.rejects(
    storage.saveProject({ ...original, name: 'Changed' }, {
      audioAssets: { 'audio-1': new Blob(['1234']) },
      assets: { 'visual-1': new Blob(['no']) },
    }),
    /incomplete or corrupted/,
  );
  assert.equal((await storage.loadProject(original.id)).document.name, original.name);

  const record = backend.records.get(original.id);
  record.media.assets['visual-1'] = null;
  await assert.rejects(storage.loadProject(original.id), /missing or unreadable/);
});

test('rejects malformed project documents and inconsistent IDs', async () => {
  const backend = new MemoryBackend();
  const storage = createProjectStorage(backend);
  await backend.put('malformed', {
    document: { ...project(), id: 'malformed', schemaVersion: 9 },
    media: media(),
  });
  const listed = await storage.listProjects();
  assert.match(listed[0].problem, /unsupported schema version 9/);
  await assert.rejects(storage.loadProject('malformed'), (error) => (
    error instanceof ProjectStorageError && /unsupported schema version 9/.test(error.message)
  ));

  await backend.put('other-key', { document: project(), media: media() });
  await assert.rejects(storage.loadProject('other-key'), /inconsistent ID/);
});

test('deletes only the selected saved project record', async () => {
  const backend = new MemoryBackend();
  const storage = createProjectStorage(backend);
  const first = project();
  const second = { ...project(), id: 'second-project', name: 'Other cut' };
  await storage.saveProject(first, media());
  await storage.saveProject(second, media());
  await storage.deleteProject(first.id);

  assert.equal(backend.records.has(first.id), false);
  assert.equal((await storage.loadProject(second.id)).document.name, 'Other cut');
});

test('saveProjectAsNew refuses to overwrite an existing project ID', async () => {
  const backend = new MemoryBackend();
  const storage = createProjectStorage(backend);
  const original = project();
  await storage.saveProject(original, media());

  await assert.rejects(
    storage.saveProjectAsNew({ ...original, name: 'Imported copy' }, media()),
    /already uses this new ID/,
  );
  assert.equal((await storage.loadProject(original.id)).document.name, original.name);
  assert.equal(backend.records.size, 1);
});

test('turns browser quota failures into actionable feedback', async () => {
  const backend = new MemoryBackend();
  backend.put = async () => {
    const error = new Error('quota');
    error.name = 'QuotaExceededError';
    throw error;
  };
  const storage = createProjectStorage(backend);
  await assert.rejects(storage.saveProject(project(), media()), /Browser storage is full/);
});

test('reports unavailable IndexedDB without throwing away the active project', async () => {
  const storage = createProjectStorage();
  await assert.rejects(storage.listProjects(), /Browser project storage is unavailable/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForVideoMetadata } from './videoMetadata.ts';

class FakeVideo {
  duration = 0;
  src = '';
  listeners = new Map();
  removedAttributes = [];
  loads = 0;

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  removeAttribute(name) {
    this.removedAttributes.push(name);
    if (name === 'src') this.src = '';
  }

  load() {
    this.loads += 1;
  }

  emit(type) {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }
}

test('resolves metadata and removes listeners without tearing down a successful source', async () => {
  const video = new FakeVideo();
  const result = waitForVideoMetadata(video, 'blob:test/video', 50);
  assert.equal(video.src, 'blob:test/video');
  video.duration = 8.5;
  video.emit('loadedmetadata');

  assert.equal(await result, 8.5);
  assert.equal(video.listeners.get('loadedmetadata').size, 0);
  assert.equal(video.listeners.get('error').size, 0);
  assert.deepEqual(video.removedAttributes, []);
  assert.equal(video.loads, 1);
});

test('times out, removes listeners, and tears down the failed source', async () => {
  const video = new FakeVideo();
  const result = waitForVideoMetadata(video, 'blob:test/bad-video', 5);

  await assert.rejects(result, /Timed out while reading video metadata/);
  assert.equal(video.src, '');
  assert.deepEqual(video.removedAttributes, ['src']);
  assert.equal(video.loads, 2);
  assert.equal(video.listeners.get('loadedmetadata').size, 0);
  assert.equal(video.listeners.get('error').size, 0);
});

test('decode errors tear down the source and reject with an actionable reason', async () => {
  const video = new FakeVideo();
  const result = waitForVideoMetadata(video, 'blob:test/bad-video', 50);
  video.emit('error');

  await assert.rejects(result, /could not decode this video/i);
  assert.equal(video.src, '');
  assert.equal(video.loads, 2);
  assert.equal(video.listeners.get('loadedmetadata').size, 0);
  assert.equal(video.listeners.get('error').size, 0);
});

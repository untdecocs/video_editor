import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForAudioMetadata } from './audioMetadata.ts';

class FakeAudio {
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
  const audio = new FakeAudio();
  const result = waitForAudioMetadata(audio, 'blob:test/audio', 50);
  assert.equal(audio.src, 'blob:test/audio');
  audio.duration = 8.5;
  audio.emit('loadedmetadata');

  assert.equal(await result, 8.5);
  assert.equal(audio.listeners.get('loadedmetadata').size, 0);
  assert.equal(audio.listeners.get('error').size, 0);
  assert.deepEqual(audio.removedAttributes, []);
  assert.equal(audio.loads, 1);
});

test('times out, removes listeners, and tears down the failed source', async () => {
  const audio = new FakeAudio();
  const result = waitForAudioMetadata(audio, 'blob:test/bad-audio', 5);

  await assert.rejects(result, /Timed out while reading audio metadata/);
  assert.equal(audio.src, '');
  assert.deepEqual(audio.removedAttributes, ['src']);
  assert.equal(audio.loads, 2);
  assert.equal(audio.listeners.get('loadedmetadata').size, 0);
  assert.equal(audio.listeners.get('error').size, 0);
});

test('decode errors tear down the source and reject with an actionable reason', async () => {
  const audio = new FakeAudio();
  const result = waitForAudioMetadata(audio, 'blob:test/bad-audio', 50);
  audio.emit('error');

  await assert.rejects(result, /could not decode this audio/i);
  assert.equal(audio.src, '');
  assert.equal(audio.loads, 2);
  assert.equal(audio.listeners.get('loadedmetadata').size, 0);
  assert.equal(audio.listeners.get('error').size, 0);
});

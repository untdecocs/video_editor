import assert from 'node:assert/strict';
import test from 'node:test';
import { getSupportedFormatsLabel, validateMediaImport } from './media.ts';

const file = (name, type = '', size = 100) => ({ name, type, size });

test('accepts supported audio and visual extensions with an empty MIME hint', () => {
  assert.deepEqual(validateMediaImport(file('Music.MP3'), 'audio'), { valid: true });
  assert.deepEqual(validateMediaImport(file('still.PNG'), 'visual'), { valid: true, visualKind: 'image' });
  assert.deepEqual(validateMediaImport(file('scene.MOV'), 'visual'), { valid: true, visualKind: 'video' });
});

test('accepts supported extensions when MIME hints are generic or absent', () => {
  assert.equal(validateMediaImport(file('music.wav', 'application/octet-stream'), 'audio').valid, true);
  assert.equal(validateMediaImport(file('cover.jpg', 'binary/octet-stream'), 'visual').valid, true);
  assert.equal(validateMediaImport(file('scene.mp4', ''), 'visual').valid, true);
});

test('rejects empty names, empty files, missing extensions, and unsupported extensions', () => {
  assert.match(validateMediaImport(file('', 'audio/mpeg'), 'audio').message, /no name/i);
  assert.match(validateMediaImport(file('silent.wav', '', 0), 'audio').message, /empty/i);
  assert.match(validateMediaImport(file('no-extension', 'audio/mpeg'), 'audio').message, /unsupported.*extension/i);
  assert.match(validateMediaImport(file('photo.gif', 'image/gif'), 'visual').message, /unsupported.*extension/i);
});

test('rejects MIME hints from an incompatible media family', () => {
  assert.match(validateMediaImport(file('voice.mp3', 'image/png'), 'audio').message, /MIME type.*conflicts/i);
  assert.match(validateMediaImport(file('clip.mp4', 'audio/mpeg'), 'visual').message, /MIME type.*conflicts/i);
  assert.match(validateMediaImport(file('still.png', 'image/svg+xml'), 'visual').message, /MIME type.*conflicts/i);
  assert.match(validateMediaImport(file('voice.mp3', 'text/plain'), 'audio').message, /MIME type.*conflicts/i);
});

test('exposes extension acceptance lists without implying codec support', () => {
  assert.match(getSupportedFormatsLabel('audio'), /\.mp3/);
  assert.match(getSupportedFormatsLabel('visual'), /\.jpg/);
  assert.match(getSupportedFormatsLabel('visual'), /\.webm/);
});

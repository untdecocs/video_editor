import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import {
  buildProjectPackage,
  parseProjectPackage,
  sanitizeProjectPackageFilename,
} from './projectPackage.ts';
import { defaultTransform } from './timeline.ts';

const project = () => ({
  id: 'portable-project',
  name: 'Portable edit',
  createdAt: '2026-11-02T12:00:00.000Z',
  updatedAt: '2026-11-02T12:30:00.000Z',
  schemaVersion: 5,
  audio: { id: 'audio-1', fileName: 'track.wav', mimeType: 'audio/wav', size: 4, duration: 12 },
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
  titleOverlays: [{
    id: 'title-1',
    text: 'A title',
    start: 1,
    duration: 3,
    x: 50,
    y: 50,
    fontSize: 8,
    fontWeight: 700,
    fontFamily: 'sans-serif',
    color: '#FFFFFF',
    align: 'center',
    background: null,
    shadow: true,
  }],
  markers: [{ id: 'marker-1', time: 4.5, label: 'Saved point' }],
  outputSettings: { presetId: 'custom', customWidth: 720, customHeight: 1280, frameRate: 30, format: 'WebM' },
});

const media = () => ({
  audio: new Blob(['1234'], { type: 'audio/wav' }),
  assets: { 'visual-1': new Blob(['12345'], { type: 'image/png' }) },
});

async function build() {
  return JSON.parse(await buildProjectPackage(project(), media(), webcrypto));
}

test('round-trips every project metadata field and all media bytes', async () => {
  const document = project();
  const blobs = media();
  const imported = await parseProjectPackage(
    await buildProjectPackage(document, blobs, webcrypto),
    webcrypto,
  );
  assert.deepEqual(imported.document, document);
  assert.equal(await imported.media.audio.text(), '1234');
  assert.equal(await imported.media.assets['visual-1'].text(), '12345');
  assert.equal(imported.media.audio.type, 'audio/wav');
  assert.equal(imported.media.assets['visual-1'].type, 'image/png');
});

test('round-trips large media and rejects malformed large base64 payloads', async () => {
  const mediaSize = 8 * 1024 * 1024;
  const audioBytes = new Uint8Array(mediaSize);
  for (let index = 0; index < audioBytes.length; index += 1) audioBytes[index] = index % 251;
  const document = project();
  document.audio.size = mediaSize;
  const packageJson = await buildProjectPackage(
    document,
    {
      audio: new Blob([audioBytes], { type: 'audio/wav' }),
      assets: media().assets,
    },
    webcrypto,
  );

  const imported = await parseProjectPackage(packageJson, webcrypto);
  const importedAudio = imported.media.audio;
  assert.ok(importedAudio);
  assert.equal(importedAudio.size, mediaSize);
  assert.equal(
    Buffer.compare(
      Buffer.from(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength),
      Buffer.from(await importedAudio.arrayBuffer()),
    ),
    0,
  );

  const malformed = JSON.parse(packageJson);
  const encoded = malformed.media.records.find((record) => record.kind === 'audio').base64;
  const invalidIndex = Math.floor(encoded.length / 2);
  malformed.media.records.find((record) => record.kind === 'audio').base64 =
    `${encoded.slice(0, invalidIndex)}!${encoded.slice(invalidIndex + 1)}`;
  await assert.rejects(
    parseProjectPackage(JSON.stringify(malformed), webcrypto),
    /malformed or oversized base64/,
  );
});

test('rejects malformed, unsupported-version, and unknown-field packages', async () => {
  await assert.rejects(parseProjectPackage('{nope', webcrypto), /not valid JSON/);
  const unsupported = await build();
  unsupported.containerVersion = 2;
  await assert.rejects(parseProjectPackage(JSON.stringify(unsupported), webcrypto), /Unsupported project package version 2/);
  const extra = await build();
  extra.unexpected = true;
  await assert.rejects(parseProjectPackage(JSON.stringify(extra), webcrypto), /unsupported field "unexpected"/);
});

test('rejects corrupt base64, digest, and declared byte lengths', async () => {
  const malformedBase64 = await build();
  malformedBase64.media.records[0].base64 = '%%%';
  await assert.rejects(parseProjectPackage(JSON.stringify(malformedBase64), webcrypto), /malformed or oversized base64/);

  const nonCanonicalBase64 = await build();
  nonCanonicalBase64.media.records[0].base64 = 'MTIzNB==';
  await assert.rejects(parseProjectPackage(JSON.stringify(nonCanonicalBase64), webcrypto), /non-canonical base64/);

  const badDigest = await build();
  badDigest.media.records[0].sha256 = '0'.repeat(64);
  await assert.rejects(parseProjectPackage(JSON.stringify(badDigest), webcrypto), /SHA-256 integrity check/);

  const badSize = await build();
  badSize.media.records[0].size += 1;
  await assert.rejects(parseProjectPackage(JSON.stringify(badSize), webcrypto), /byte length does not match project metadata/);
});

test('rejects unsupported or inconsistent MIME types and unsafe names', async () => {
  const wrongMime = await build();
  wrongMime.media.records[0].mimeType = 'video/mp4';
  await assert.rejects(parseProjectPackage(JSON.stringify(wrongMime), webcrypto), /unsupported or mismatched MIME type/);

  const unsafe = await build();
  unsafe.media.records[0].fileName = '../still.png';
  await assert.rejects(parseProjectPackage(JSON.stringify(unsafe), webcrypto), /filename .* unsafe/);

  const mimeMismatch = await build();
  mimeMismatch.media.records[0].mimeType = 'image/jpeg';
  await assert.rejects(parseProjectPackage(JSON.stringify(mimeMismatch), webcrypto), /unsupported or mismatched MIME type/);
});

test('rejects missing, extra, and duplicate media records', async () => {
  const missing = await build();
  missing.media.records.pop();
  await assert.rejects(parseProjectPackage(JSON.stringify(missing), webcrypto), /missing media record/);

  const extra = await build();
  extra.media.records.push({ ...extra.media.records[0], assetId: 'unknown-asset' });
  await assert.rejects(parseProjectPackage(JSON.stringify(extra), webcrypto), /Unexpected media record/);

  const duplicate = await build();
  duplicate.media.records.push({ ...duplicate.media.records[0] });
  await assert.rejects(parseProjectPackage(JSON.stringify(duplicate), webcrypto), /duplicate asset ID/);
});

test('build rejects missing, extra, and size-inconsistent source blobs', async () => {
  const document = project();
  await assert.rejects(
    buildProjectPackage(document, { audio: media().audio, assets: {} }, webcrypto),
    /missing or its size does not match/,
  );
  await assert.rejects(
    buildProjectPackage(document, { audio: media().audio, assets: { 'visual-1': media().assets['visual-1'], unexpected: new Blob(['x']) } }, webcrypto),
    /Unexpected media record/,
  );
  await assert.rejects(
    buildProjectPackage(document, { audio: new Blob(['x']), assets: media().assets }, webcrypto),
    /missing or its size does not match/,
  );
});

test('sanitizes downloaded package filenames', () => {
  assert.equal(sanitizeProjectPackageFilename('../A * project'), 'A---project.stillwave.json');
  assert.equal(sanitizeProjectPackageFilename('  '), 'project.stillwave.json');
});

test('failed package validation leaves source project and media untouched', async () => {
  const document = project();
  const blobs = media();
  const sourceSnapshot = structuredClone(document);
  const originalAudio = await blobs.audio.text();
  const invalid = await build();
  invalid.media.records[0].sha256 = 'f'.repeat(64);
  await assert.rejects(parseProjectPackage(JSON.stringify(invalid), webcrypto), /integrity check/);
  assert.deepEqual(document, sourceSnapshot);
  assert.equal(await blobs.audio.text(), originalAudio);
});

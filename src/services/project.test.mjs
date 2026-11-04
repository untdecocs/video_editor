import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProject, ProjectDocumentError, serializeProject } from './project.ts';
import { defaultTransform } from './timeline.ts';

const sampleProject = () => ({
  id: 'project-1',
  name: 'Social cut',
  createdAt: '2026-11-02T12:00:00.000Z',
  updatedAt: '2026-11-02T12:30:00.000Z',
  schemaVersion: 3,
  audio: {
    id: 'audio-1',
    fileName: 'narration.wav',
    mimeType: 'audio/wav',
    size: 482_100,
    duration: 42.5,
  },
  assets: [
    {
      id: 'visual-image',
      fileName: 'cover.png',
      mimeType: 'image/png',
      size: 91_200,
      kind: 'image',
      duration: 5,
    },
    {
      id: 'visual-video',
      fileName: 'scene.mp4',
      mimeType: 'video/mp4',
      size: 1_024_000,
      kind: 'video',
      duration: 12,
    },
  ],
  tracks: [
    { id: 'track-base', name: 'Base video', order: 0, visible: true, locked: false },
    { id: 'track-overlay', name: 'Overlay', order: 1, visible: true, locked: false },
  ],
  clips: [
    {
      id: 'clip-image',
      assetId: 'visual-image',
      trackId: 'track-base',
      timelinePosition: 0,
      start: 0,
      end: 0,
      stillDuration: 6,
      transition: 'fade',
      transform: { ...defaultTransform, fit: 'contain', zoom: 1.2, x: -0.1, flipY: true },
    },
    {
      id: 'clip-video',
      assetId: 'visual-video',
      trackId: 'track-overlay',
      timelinePosition: 2,
      start: 1.5,
      end: 9.5,
      stillDuration: 5,
      transition: 'none',
      transform: { ...defaultTransform, rotation: 90 },
    },
  ],
  titleOverlays: [],
  outputSettings: {
    presetId: 'custom',
    customWidth: 1440,
    customHeight: 1080,
    frameRate: 30,
    format: 'WebM',
  },
});

test('serializes and parses a representative project edit/settings round-trip', () => {
  const project = sampleProject();
  const json = serializeProject(project);
  assert.deepEqual(parseProject(json), project);
  assert.equal(JSON.parse(json).assets[0].fileName, 'cover.png');
  assert.equal(JSON.parse(json).clips[1].start, 1.5);
  assert.deepEqual(JSON.parse(json).outputSettings, project.outputSettings);
});

test('supports an empty audio slot and no visual edits', () => {
  const project = sampleProject();
  project.audio = null;
  project.assets = [];
  project.clips = [];
  assert.deepEqual(parseProject(serializeProject(project)), project);
});

test('reports invalid JSON and malformed schema documents', () => {
  assert.throws(() => parseProject('{not json'), /Invalid project JSON:/);
  const missingAudio = sampleProject();
  delete missingAudio.audio;
  assert.throws(() => parseProject(JSON.stringify(missingAudio)), /project\.audio/);
  assert.throws(
    () => parseProject(JSON.stringify({ ...sampleProject(), schemaVersion: 4 })),
    /unsupported schema version 4/,
  );
});

test('migrates a legacy v1 ordered sequence to a default track and v3 without changing clip timing or edits', () => {
  const legacy = sampleProject();
  legacy.schemaVersion = 1;
  delete legacy.tracks;
  delete legacy.titleOverlays;
  legacy.clips = legacy.clips.map(({ trackId, timelinePosition, ...clip }) => clip);
  const migrated = parseProject(JSON.stringify(legacy));
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.titleOverlays, []);
  assert.deepEqual(migrated.tracks, [{
    id: 'track-video-1', name: 'Video 1', order: 0, visible: true, locked: false,
  }]);
  assert.deepEqual(migrated.clips.map(({ timelinePosition, trackId }) => ({ timelinePosition, trackId })), [
    { timelinePosition: 0, trackId: 'track-video-1' },
    { timelinePosition: 6, trackId: 'track-video-1' },
  ]);
  assert.equal(migrated.clips[0].stillDuration, legacy.clips[0].stillDuration);
  assert.equal(migrated.clips[0].transition, legacy.clips[0].transition);
  assert.deepEqual(migrated.clips[0].transform, legacy.clips[0].transform);
  assert.equal(migrated.clips[1].start, legacy.clips[1].start);
  assert.equal(migrated.clips[1].end, legacy.clips[1].end);
  assert.deepEqual(migrated.assets, legacy.assets);
  assert.deepEqual(migrated.audio, legacy.audio);
});

test('migrates v2 projects to v3 while preserving tracks, clips, media, and output settings', () => {
  const legacy = sampleProject();
  legacy.schemaVersion = 2;
  delete legacy.titleOverlays;
  const migrated = parseProject(JSON.stringify(legacy));
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.titleOverlays, []);
  assert.deepEqual(migrated.tracks, legacy.tracks);
  assert.deepEqual(migrated.clips, legacy.clips);
  assert.deepEqual(migrated.assets, legacy.assets);
  assert.deepEqual(migrated.audio, legacy.audio);
  assert.deepEqual(migrated.outputSettings, legacy.outputSettings);
});

test('serializes title overlays and strictly rejects malformed title values or fields', () => {
  const title = {
    id: 'title-1',
    text: 'First line\nSecond line',
    start: 1.25,
    duration: 3,
    x: 50,
    y: 80,
    fontSize: 5,
    fontWeight: 700,
    fontFamily: 'sans-serif',
    color: '#ffffff',
    align: 'center',
    background: '#000000',
    shadow: true,
  };
  const project = sampleProject();
  project.titleOverlays = [title];
  const serialized = parseProject(serializeProject(project));
  assert.equal(serialized.titleOverlays[0].text, title.text);
  assert.equal(serialized.titleOverlays[0].color, '#FFFFFF');
  assert.equal(serialized.titleOverlays[0].background, '#000000');

  const cases = [
    [{ text: '' }, /titleOverlays\[0\]\.text/],
    [{ text: 'x'.repeat(501) }, /titleOverlays\[0\]\.text/],
    [{ id: '' }, /titleOverlays\[0\]\.id/],
    [{ id: 'title / 1' }, /titleOverlays\[0\]\.id/],
    [{ start: -0.1 }, /titleOverlays\[0\]\.start/],
    [{ duration: 0 }, /titleOverlays\[0\]\.duration/],
    [{ start: 86_399, duration: 2 }, /title timing/],
    [{ x: 101 }, /titleOverlays\[0\]\.x/],
    [{ y: -1 }, /titleOverlays\[0\]\.y/],
    [{ fontSize: 21 }, /titleOverlays\[0\]\.fontSize/],
    [{ fontWeight: 500 }, /titleOverlays\[0\]\.fontWeight/],
    [{ fontFamily: 'Comic Sans' }, /titleOverlays\[0\]\.fontFamily/],
    [{ color: 'red' }, /titleOverlays\[0\]\.color/],
    [{ align: 'justify' }, /titleOverlays\[0\]\.align/],
    [{ background: 'rgba(0,0,0,.5)' }, /titleOverlays\[0\]\.background/],
    [{ shadow: 'yes' }, /titleOverlays\[0\]\.shadow/],
    [{ extra: true }, /unexpected field extra/],
  ];
  for (const [patch, expected] of cases) {
    const invalid = sampleProject();
    invalid.titleOverlays = [{ ...title, ...patch }];
    assert.throws(() => serializeProject(invalid), expected);
  }
  const duplicate = sampleProject();
  duplicate.titleOverlays = [title, { ...title, id: 'clip-image' }];
  assert.throws(() => serializeProject(duplicate), /duplicate id "clip-image"/);
});

test('rejects duplicate IDs and missing visual asset references', () => {
  const duplicateProjectId = sampleProject();
  duplicateProjectId.assets[0].id = duplicateProjectId.id;
  assert.throws(() => serializeProject(duplicateProjectId), /duplicate id "project-1"/);

  const duplicate = sampleProject();
  duplicate.clips[0].id = duplicate.assets[0].id;
  assert.throws(() => serializeProject(duplicate), /duplicate id "visual-image"/);

  const missingReference = sampleProject();
  missingReference.clips[0].assetId = 'not-present';
  assert.throws(() => serializeProject(missingReference), /references missing visual asset "not-present"/);

  const missingTrack = sampleProject();
  missingTrack.clips[0].trackId = 'not-present';
  assert.throws(() => serializeProject(missingTrack), /references missing visual track "not-present"/);

  const duplicateAudioId = sampleProject();
  duplicateAudioId.audio.id = duplicateAudioId.assets[0].id;
  assert.throws(() => serializeProject(duplicateAudioId), /duplicate id "visual-image"/);
});

test('rejects invalid track schema, duplicate track order, and malformed timeline positions', () => {
  const missingTrack = sampleProject();
  missingTrack.tracks = [];
  assert.throws(() => serializeProject(missingTrack), /at least one visual track/);

  const duplicateOrder = sampleProject();
  duplicateOrder.tracks[1].order = duplicateOrder.tracks[0].order;
  assert.throws(() => serializeProject(duplicateOrder), /track order values must be unique/);

  const badPosition = sampleProject();
  badPosition.clips[0].timelinePosition = -1;
  assert.throws(() => serializeProject(badPosition), /clips\[0\]\.timelinePosition/);
});

test('rejects invalid numeric values and malformed timeline transforms', () => {
  const invalidNumber = sampleProject();
  invalidNumber.clips[1].end = Number.NaN;
  assert.throws(
    () => serializeProject(invalidNumber),
    (error) => error instanceof ProjectDocumentError && /clips\[1\]\.end/.test(error.message),
  );

  const negativeDimensions = sampleProject();
  negativeDimensions.outputSettings.customWidth = 0;
  assert.throws(() => serializeProject(negativeDimensions), /outputSettings\.customWidth/);

  const reversedSourceRange = sampleProject();
  reversedSourceRange.clips[1].start = 10;
  assert.throws(() => serializeProject(reversedSourceRange), /end.*greater than or equal to start/);
});

test('prevents runtime File/object URL fields from entering serialized project JSON', () => {
  const withVisualRuntimeFields = sampleProject();
  withVisualRuntimeFields.assets[0].file = { name: 'transient.png' };
  withVisualRuntimeFields.assets[0].url = 'blob:https://example.invalid/transient';
  assert.throws(() => serializeProject(withVisualRuntimeFields), /unexpected field file/);

  const withAudioRuntimeFields = sampleProject();
  withAudioRuntimeFields.audio.url = 'blob:https://example.invalid/audio';
  assert.throws(() => serializeProject(withAudioRuntimeFields), /unexpected field url/);

  const withUrlInMetadata = sampleProject();
  withUrlInMetadata.assets[0].fileName = 'blob:https://example.invalid/visual';
  assert.throws(() => serializeProject(withUrlInMetadata), /object URLs are not permitted/);

  const json = serializeProject(sampleProject());
  assert.equal(json.includes('"file"'), false);
  assert.equal(json.includes('"url"'), false);
  assert.equal(json.includes('blob:'), false);
});

test('rejects unexpected fields and malformed settings values', () => {
  const unknownField = sampleProject();
  unknownField.unexpected = true;
  assert.throws(() => serializeProject(unknownField), /unexpected field unexpected/);

  const invalidPreset = sampleProject();
  invalidPreset.outputSettings.presetId = '';
  assert.throws(() => serializeProject(invalidPreset), /outputSettings\.presetId/);

  const invalidTimestamp = sampleProject();
  invalidTimestamp.createdAt = 'not-a-timestamp';
  assert.throws(() => serializeProject(invalidTimestamp), /project\.createdAt/);
});

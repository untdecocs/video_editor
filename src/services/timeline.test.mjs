import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultTransform,
  formatAspectRatio,
  getClipDuration,
  getTimelineDuration,
  moveClip,
  platformPresets,
  splitClip,
} from './timeline.ts';

const videoClip = (id, start = 0, end = 10) => ({
  id,
  assetId: `asset-${id}`,
  start,
  end,
  stillDuration: 5,
  transition: 'none',
  transform: { ...defaultTransform },
});

test('uses source range for video and configured duration for stills', () => {
  assert.equal(getClipDuration(videoClip('video', 2, 8)), 6);
  assert.equal(getClipDuration({ ...videoClip('still'), end: 0, stillDuration: 7 }), 7);
});

test('sums sequence duration', () => {
  const still = { ...videoClip('two'), end: 0, stillDuration: 3 };
  assert.equal(getTimelineDuration([videoClip('one', 0, 4), still]), 7);
});

test('moves a clip without mutating the original list', () => {
  const clips = [videoClip('one'), videoClip('two'), videoClip('three')];
  const moved = moveClip(clips, 0, 2);
  assert.deepEqual(moved.map((clip) => clip.id), ['two', 'three', 'one']);
  assert.deepEqual(clips.map((clip) => clip.id), ['one', 'two', 'three']);
});

test('splits a clip into adjacent source ranges', () => {
  const clips = [videoClip('one', 2, 12)];
  const split = splitClip(clips, 'one', 7);
  assert.equal(split.length, 2);
  assert.equal(split[0].start, 2);
  assert.equal(split[0].end, 7);
  assert.equal(split[1].start, 7);
  assert.equal(split[1].end, 12);
  assert.equal(getTimelineDuration(split), getTimelineDuration(clips));
});

test('keeps common platform presets available', () => {
  assert.deepEqual(platformPresets.map((preset) => preset.id), [
    'youtube', 'instagram', 'tiktok', 'x', 'linkedin', 'pinterest', 'facebook', 'snapchat', 'custom',
  ]);
  assert.deepEqual(
    { ...platformPresets.find((preset) => preset.id === 'tiktok') },
    { id: 'tiktok', platform: 'TikTok', placement: 'Video', width: 1080, height: 1920 },
  );
  assert.equal(formatAspectRatio(1920, 1080), '16:9');
  assert.equal(formatAspectRatio(1080, 1920), '9:16');
  assert.equal(formatAspectRatio(1000, 1500), '2:3');
});
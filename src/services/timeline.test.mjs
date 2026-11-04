import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampTimelineTime,
  createTimelineMarker,
  defaultTransform,
  duplicateTimelineClip,
  getClipDuration,
  getTimelineDuration,
  getTimelinePositionFromDrop,
  moveClip,
  normalizeStillDuration,
  getActiveClips,
  getClipSourceTime,
  locateClipAtTime,
  platformPresets,
  snapTimelinePosition,
  splitClip,
  splitClipAtTimelineTime,
  setStillDurationMode,
  updateMatchedStillDurations,
} from './timeline.ts';
import {
  getPreviewPlaybackRejectionStatus,
  getPreviewVideoFailureStatus,
  getPreviewVideoStatusMessage,
  shouldSeekPreviewVideo,
} from './videoPreview.ts';

const videoClip = (id, start = 0, end = 10) => ({
  id,
  assetId: `asset-${id}`,
  trackId: 'track-a',
  timelinePosition: 0,
  start,
  end,
  stillDuration: 5,
  stillDurationMode: 'custom',
  transition: 'none',
  transform: { ...defaultTransform },
});

test('uses source range for video and configured duration for stills', () => {
  assert.equal(getClipDuration(videoClip('video', 2, 8)), 6);
  assert.equal(getClipDuration({ ...videoClip('still'), end: 0, stillDuration: 7 }), 7);
});

test('resolves matched still durations, preserves unknown last-known values, and supports long custom stills', () => {
  const still = {
    ...videoClip('still'),
    end: 0,
    timelinePosition: 3,
    stillDuration: 45,
    stillDurationMode: 'custom',
  };
  assert.equal(getClipDuration(still), 45);
  assert.equal(getClipDuration(setStillDurationMode(still, 'match-audio', 72.5)), 72.5);
  const matched = { ...still, stillDurationMode: 'match-audio', stillDuration: 72.5 };
  const replaced = updateMatchedStillDurations([matched, still], 120);
  assert.equal(getClipDuration(replaced[0]), 120);
  assert.equal(getClipDuration(replaced[1]), 45);
  assert.equal(updateMatchedStillDurations(replaced, 0), replaced);
  assert.equal(getClipDuration(updateMatchedStillDurations(replaced, Number.NaN)[0]), 120);
  assert.equal(normalizeStillDuration(0, 0), 0.1);
  assert.equal(normalizeStillDuration(90_000, 10), 86_390);
  assert.equal(getTimelineDuration([still]), 48);
  assert.equal(getClipDuration(videoClip('video', 2, 8)), 6);
});

test('sums sequence duration', () => {
  const still = { ...videoClip('two'), timelinePosition: 4, end: 0, stillDuration: 3 };
  assert.equal(getTimelineDuration([videoClip('one', 0, 4), still]), 7);
});

test('clamps timeline seeks to the soundtrack playback boundary without changing clips', () => {
  const clip = { ...videoClip('after-soundtrack', 0, 8), timelinePosition: 12 };
  const originalClip = { ...clip };
  assert.equal(clampTimelineTime(15, 10), 10);
  assert.equal(clampTimelineTime(-2, 10), 0);
  assert.equal(clampTimelineTime(Number.POSITIVE_INFINITY, 10), 0);
  assert.equal(clampTimelineTime(4, Number.NaN), 0);
  assert.equal(getTimelineDuration([clip]), 20);
  assert.deepEqual(clip, originalClip);
});

test('creates a stable marker model with a default label and bounded playhead time', () => {
  const marker = createTimelineMarker([], 8.25, () => 'marker-stable');
  assert.deepEqual(marker, { id: 'marker-stable', time: 8.25, label: 'Marker 1' });
  assert.equal(createTimelineMarker([marker], -2, () => 'marker-two').time, 0);
  assert.equal(createTimelineMarker([marker], 90_000, () => 'marker-three').time, 86_400);
});

test('snaps clip positions deterministically while keeping an explicit unsnapped path', () => {
  assert.equal(snapTimelinePosition(1.24, true), 1.2);
  assert.equal(snapTimelinePosition(1.25, true), 1.3);
  assert.equal(snapTimelinePosition(1.26, true), 1.3);
  assert.equal(snapTimelinePosition(-0.04, true), 0);
  assert.equal(snapTimelinePosition(-2, false), 0);
  assert.equal(snapTimelinePosition(1.234, false), 1.234);
  assert.equal(snapTimelinePosition(Number.NaN, true), 0);
  assert.equal(snapTimelinePosition(1.26, true, 0), 1.3);
});

test('converts pointer drops to absolute positions while preserving the grab offset', () => {
  assert.equal(getTimelinePositionFromDrop(250, 50, 100, 25, false), 1.75);
  assert.equal(getTimelinePositionFromDrop(250, 50, 100, 25, true), 1.8);
  assert.equal(getTimelinePositionFromDrop(60, 50, 100, 25, false), 0);
  assert.equal(getTimelinePositionFromDrop(250, 50, 0, 25, true), 0);
});

test('maps overlaps to absolute time, respects visibility, and layers in track order', () => {
  const tracks = [
    { id: 'top', name: 'Top', order: 1, visible: true, locked: false },
    { id: 'base', name: 'Base', order: 0, visible: true, locked: false },
    { id: 'hidden', name: 'Hidden', order: 2, visible: false, locked: false },
  ];
  const clips = [
    { ...videoClip('overlay'), trackId: 'top', timelinePosition: 2 },
    { ...videoClip('background', 1, 6), trackId: 'base', timelinePosition: 0 },
    { ...videoClip('hidden'), trackId: 'hidden', timelinePosition: 0 },
  ];
  assert.equal(getTimelineDuration(clips), 12);
  assert.deepEqual(getActiveClips(tracks, clips, 4).map(({ clip, elapsed }) => [clip.id, elapsed]), [
    ['background', 4],
    ['overlay', 2],
  ]);
  assert.deepEqual(getActiveClips(tracks, clips, 6).map(({ clip }) => clip.id), ['overlay']);
  assert.equal(locateClipAtTime(clips, 4).clip.id, 'overlay');
  assert.equal(getClipSourceTime(clips[0], 4), 2);
});

test('maps timeline time into the clip source range and uses inclusive start, exclusive end boundaries', () => {
  const clip = { ...videoClip('mapped', 3, 9), timelinePosition: 12 };
  const tracks = [{ id: 'track-a', name: 'Video', order: 0, visible: true, locked: false }];

  assert.deepEqual(getActiveClips(tracks, [clip], 11.999), []);
  assert.deepEqual(getActiveClips(tracks, [clip], 12).map(({ clip: activeClip }) => activeClip.id), ['mapped']);
  assert.equal(getClipSourceTime(clip, 12), 3);
  assert.equal(getClipSourceTime(clip, 15.5), 6.5);
  assert.deepEqual(getActiveClips(tracks, [clip], 18), []);
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
  assert.equal(split[1].timelinePosition, 5);
  assert.equal(getTimelineDuration(split), getTimelineDuration(clips));
});

test('duplicates clips directly after the source with a unique ID and preserved editing properties', () => {
  const source = {
    ...videoClip('source', 2, 8),
    trackId: 'track-overlay',
    timelinePosition: 3.5,
    transition: 'fade',
    transform: { ...defaultTransform, zoom: 1.7, x: -12, rotation: 90 },
  };
  const existing = videoClip('already-used-id');
  const clips = [source, existing];
  const generatedIds = ['already-used-id', 'duplicate-id'];
  const duplicated = duplicateTimelineClip(clips, 'source', () => generatedIds.shift());
  const copy = duplicated[1];
  assert.equal(copy.id, 'duplicate-id');
  assert.equal(copy.trackId, source.trackId);
  assert.equal(copy.timelinePosition, source.timelinePosition + getClipDuration(source));
  assert.deepEqual([copy.start, copy.end], [source.start, source.end]);
  assert.equal(copy.transition, source.transition);
  assert.deepEqual(copy.transform, source.transform);
  assert.notEqual(copy.transform, source.transform);
  assert.deepEqual(clips, [source, existing]);
  assert.equal(duplicateTimelineClip(clips, 'missing'), clips);
});

test('splits at the absolute playhead while retaining source in/out and still duration', () => {
  const video = { ...videoClip('video', 4, 10), timelinePosition: 12 };
  assert.equal(getClipSourceTime(video, 15), 7);
  const [videoA, videoB] = splitClipAtTimelineTime([video], 'video', 15);
  assert.deepEqual([videoA.start, videoA.end, videoA.timelinePosition], [4, 7, 12]);
  assert.deepEqual([videoB.start, videoB.end, videoB.timelinePosition], [7, 10, 15]);
  const still = { ...videoClip('still'), end: 0, timelinePosition: 5, stillDuration: 8 };
  const [stillA, stillB] = splitClipAtTimelineTime([still], 'still', 8);
  assert.deepEqual([stillA.stillDuration, stillA.timelinePosition], [3, 5]);
  assert.deepEqual([stillB.stillDuration, stillB.timelinePosition], [5, 8]);
  assert.deepEqual([stillA.stillDurationMode, stillB.stillDurationMode], ['custom', 'custom']);
});

test('splitting a matched still preserves its durations after soundtrack replacement', () => {
  const matchedStill = {
    ...videoClip('matched-still'),
    end: 0,
    stillDuration: 40,
    stillDurationMode: 'match-audio',
  };
  const split = splitClipAtTimelineTime([matchedStill], 'matched-still', 15);

  assert.deepEqual(split.map((clip) => clip.stillDuration), [15, 25]);
  assert.deepEqual(split.map((clip) => clip.timelinePosition), [0, 15]);
  assert.deepEqual(split.map((clip) => clip.stillDurationMode), ['custom', 'custom']);

  const afterSoundtrackReplacement = updateMatchedStillDurations(split, 55);
  assert.deepEqual(afterSoundtrackReplacement.map((clip) => clip.stillDuration), [15, 25]);
  assert.deepEqual(afterSoundtrackReplacement.map((clip) => clip.timelinePosition), [0, 15]);
});

test('keeps common platform presets available', () => {
  assert.deepEqual(platformPresets.map((preset) => preset.id), [
    'youtube', 'instagram', 'tiktok', 'x', 'linkedin', 'pinterest', 'facebook', 'snapchat', 'custom',
  ]);
  assert.deepEqual(
    { ...platformPresets.find((preset) => preset.id === 'tiktok') },
    { id: 'tiktok', platform: 'TikTok', placement: 'Video', width: 1080, height: 1920 },
  );
});

test('forces preview seeks to in-points around the reported failure range', () => {
  for (const targetTime of [0, 0.1, 0.2, 0.4, 0.5]) {
    assert.equal(
      shouldSeekPreviewVideo(0, targetTime, true),
      true,
      `expected a forced seek for ${targetTime}s`,
    );
  }
});

test('retains the playback drift threshold but forces seeks after paused scrubs', () => {
  assert.equal(shouldSeekPreviewVideo(0, 0.2), false);
  assert.equal(shouldSeekPreviewVideo(0, 0.4), false);
  assert.equal(shouldSeekPreviewVideo(0, 0.5), true);
  assert.equal(shouldSeekPreviewVideo(0, 0.2, true), true);
});

test('classifies preview loading, decode, unavailable, and playback-blocked feedback', () => {
  assert.equal(getPreviewVideoStatusMessage('loading'), 'Loading video preview…');
  assert.equal(getPreviewVideoFailureStatus(3), 'decode-error');
  assert.equal(getPreviewVideoStatusMessage(getPreviewVideoFailureStatus(3)), 'This video could not be decoded.');
  assert.equal(getPreviewVideoFailureStatus(4), 'unavailable');
  assert.equal(getPreviewPlaybackRejectionStatus('NotAllowedError'), 'playback-blocked');
  assert.equal(getPreviewPlaybackRejectionStatus('AbortError'), null);
  assert.equal(getPreviewVideoStatusMessage('ready'), null);
});
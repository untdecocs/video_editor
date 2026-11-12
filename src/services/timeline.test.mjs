import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampTimelineTime,
  createTimelineMarker,
  defaultTransform,
  duplicateTimelineClip,
  getClipDuration,
  getAudioClipDuration,
  getAudioTimelineDuration,
  getLongestAudioTrackDuration,
  getVideoTimelineDuration,
  getTimelineDuration,
  getVisualCoverage,
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

const coverageAsset = (clip, kind = 'video') => ({
  id: clip.assetId,
  file: new File([], `${clip.id}.mp4`),
  url: `blob:${clip.id}`,
  kind,
  duration: 100,
});

test('visual coverage distinguishes internal gaps from overflow even when durations balance', () => {
  const clips = [
    { ...videoClip('late', 0, 6), timelinePosition: 6 },
    videoClip('first', 2, 6),
  ];
  assert.deepEqual(getVisualCoverage(clips, clips.map((clip) => coverageAsset(clip)), 10), {
    soundtrackDuration: 10,
    coveredDuration: 8,
    uncoveredDuration: 2,
    uncoveredIntervals: [{ start: 4, end: 6 }],
    overflowDuration: 2,
    overflowIntervals: [{ start: 10, end: 12 }],
  });
});

test('visual coverage merges overlapping and adjacent clips without counting overlap twice', () => {
  const clips = [
    { ...videoClip('later', 0, 4), timelinePosition: 6 },
    { ...videoClip('overlap', 0, 5), timelinePosition: 3 },
    { ...videoClip('first', 0, 4), timelinePosition: 1 },
    { ...videoClip('adjacent', 0, 2), timelinePosition: 10 },
  ];
  const result = getVisualCoverage(clips, clips.map((clip) => coverageAsset(clip)), 14);
  assert.equal(result.coveredDuration, 11);
  assert.equal(result.uncoveredDuration, 3);
  assert.deepEqual(result.uncoveredIntervals, [{ start: 0, end: 1 }, { start: 12, end: 14 }]);
  assert.deepEqual(result.overflowIntervals, []);
});

test('visual coverage reports disjoint overflow separately from soundtrack gaps', () => {
  const clips = [
    videoClip('crossing', 0, 12),
    { ...videoClip('overlapping', 0, 4), timelinePosition: 11 },
    { ...videoClip('beyond', 0, 2), timelinePosition: 17 },
  ];
  const result = getVisualCoverage(clips, clips.map((clip) => coverageAsset(clip)), 10);
  assert.equal(result.coveredDuration, 10);
  assert.deepEqual(result.uncoveredIntervals, []);
  assert.deepEqual(result.overflowIntervals, [{ start: 10, end: 15 }, { start: 17, end: 19 }]);
  assert.equal(result.overflowDuration, 7);
  const beyondOnly = getVisualCoverage([clips[2]], [coverageAsset(clips[2])], 10);
  assert.deepEqual(beyondOnly.uncoveredIntervals, [{ start: 0, end: 10 }]);
  assert.equal(beyondOnly.overflowDuration, 2);
});

test('visual coverage uses stored still durations and source trims, ignoring missing assets', () => {
  const clips = [
    { ...videoClip('trimmed', 20, 23), timelinePosition: 2 },
    { ...videoClip('still', 0, 0), timelinePosition: 5, stillDuration: 4, stillDurationMode: 'match-audio' },
    { ...videoClip('missing'), timelinePosition: 0 },
  ];
  const result = getVisualCoverage(clips, [coverageAsset(clips[0]), coverageAsset(clips[1], 'image')], 10);
  assert.equal(result.coveredDuration, 7);
  assert.deepEqual(result.uncoveredIntervals, [{ start: 0, end: 2 }, { start: 9, end: 10 }]);
});

test('visual coverage filters hidden and unknown tracks only when tracks are supplied', () => {
  const clips = [
    { ...videoClip('visible', 0, 4), trackId: 'visible' },
    { ...videoClip('hidden', 0, 12), trackId: 'hidden', timelinePosition: 2 },
    { ...videoClip('unknown', 0, 4), trackId: 'unknown', timelinePosition: 6 },
  ];
  const assets = clips.map((clip) => coverageAsset(clip));
  const tracks = [
    { id: 'visible', visible: true, locked: true, order: 0, name: 'Visible' },
    { id: 'hidden', visible: false, locked: false, order: 1, name: 'Hidden' },
  ];
  assert.equal(getVisualCoverage(clips, assets, 10).coveredDuration, 10);
  assert.equal(getVisualCoverage(clips, assets, 10).overflowDuration, 4);
  const visible = getVisualCoverage(clips, assets, 10, tracks);
  assert.deepEqual(visible.uncoveredIntervals, [{ start: 4, end: 10 }]);
  assert.equal(visible.overflowDuration, 0);
  assert.equal(getVisualCoverage(clips, assets, 10, []).coveredDuration, 0);
});

test('visual coverage handles empty timelines and normalizes unusable soundtrack durations to zero', () => {
  assert.deepEqual(getVisualCoverage([], [], 3), {
    soundtrackDuration: 3,
    coveredDuration: 0,
    uncoveredDuration: 3,
    uncoveredIntervals: [{ start: 0, end: 3 }],
    overflowDuration: 0,
    overflowIntervals: [],
  });
  const clip = videoClip('one', 0, 2);
  for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = getVisualCoverage([clip], [coverageAsset(clip)], duration);
    assert.equal(result.soundtrackDuration, 0);
    assert.equal(result.coveredDuration, 0);
    assert.equal(result.uncoveredDuration, 0);
    assert.deepEqual(result.uncoveredIntervals, []);
    assert.deepEqual(result.overflowIntervals, [{ start: 0, end: 2 }]);
  }
});

test('visual coverage clips negative timeline positions at zero and ignores non-finite ranges', () => {
  const clips = [
    { ...videoClip('negative', 0, 4), timelinePosition: -2 },
    { ...videoClip('before', 0, 1), timelinePosition: -3 },
    { ...videoClip('nan-position'), timelinePosition: Number.NaN },
    videoClip('infinite-duration', 0, Number.POSITIVE_INFINITY),
    { ...videoClip('infinite-position'), timelinePosition: Number.POSITIVE_INFINITY },
    { ...videoClip('nan-duration', 0, 0), stillDuration: Number.NaN },
  ];
  const result = getVisualCoverage(clips, clips.map((clip) => coverageAsset(clip)), 4);
  assert.equal(result.coveredDuration, 2);
  assert.deepEqual(result.uncoveredIntervals, [{ start: 2, end: 4 }]);
  assert.deepEqual(result.overflowIntervals, []);
});

test('visual coverage does not mutate frozen inputs or share mutable result intervals', () => {
  const clips = Object.freeze([
    Object.freeze({ ...videoClip('later', 0, 3), timelinePosition: 4 }),
    Object.freeze(videoClip('first', 0, 2)),
  ]);
  const assets = Object.freeze(clips.map((clip) => Object.freeze(coverageAsset(clip))));
  const tracks = Object.freeze([Object.freeze({ id: 'track-a', visible: true })]);
  const result = getVisualCoverage(clips, assets, 6, tracks);
  result.uncoveredIntervals[0].start = 100;
  assert.deepEqual(getVisualCoverage(clips, assets, 6, tracks).uncoveredIntervals, [{ start: 2, end: 4 }]);
  assert.deepEqual(clips.map((clip) => clip.timelinePosition), [4, 0]);
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
  assert.equal(getClipDuration(setStillDurationMode(still, 'match-audio', 72.5)), 69.5);
  const matched = { ...still, stillDurationMode: 'match-audio', stillDuration: 72.5 };
  const replaced = updateMatchedStillDurations([matched, still], 120);
  assert.equal(getClipDuration(replaced[0]), 117);
  assert.equal(getClipDuration(replaced[1]), 45);
  assert.equal(updateMatchedStillDurations(replaced, 0), replaced);
  assert.equal(getClipDuration(updateMatchedStillDurations(replaced, Number.NaN)[0]), 117);
  assert.equal(normalizeStillDuration(0, 0), 0.1);
  assert.equal(normalizeStillDuration(90_000, 10), 86_390);
  assert.equal(getTimelineDuration([still]), 48);
  assert.equal(getClipDuration(videoClip('video', 2, 8)), 6);
});

test('matches stills to remaining video sequence duration and resolves multiple audio-track lengths', () => {
  const still = { ...videoClip('still'), end: 0, timelinePosition: 4, stillDuration: 2, stillDurationMode: 'custom' };
  assert.equal(getClipDuration(setStillDurationMode(still, 'match-video', 0, 15)), 11);
  const videoDuration = getVideoTimelineDuration(
    [{ ...videoClip('video', 2, 7), timelinePosition: 3 }],
    [{ id: 'asset-video', kind: 'video' }],
    [{ id: 'track-a', visible: true }],
  );
  assert.equal(videoDuration, 8);

  const clips = [
    { id: 'audio-clip-1', assetId: 'audio-1', trackId: 'audio-track-1', timelinePosition: 1, start: 2, end: 6, volume: 1 },
    { id: 'audio-clip-2', assetId: 'audio-2', trackId: 'audio-track-2', timelinePosition: 3, start: 0, end: 8, volume: 0.5 },
  ];
  assert.equal(getAudioClipDuration(clips[0]), 4);
  assert.equal(getAudioTimelineDuration(clips), 11);
  assert.equal(getLongestAudioTrackDuration([
    { id: 'audio-track-1', visible: true },
    { id: 'audio-track-2', visible: false },
  ], clips), 5);
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
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultTitle, getActiveTitles, mapTitleToOutput } from './titleOverlay.ts';

test('title activity uses an inclusive start and exclusive end', () => {
  const first = createDefaultTitle('first', 2);
  first.duration = 3;
  const second = createDefaultTitle('second', 5);
  assert.deepEqual(getActiveTitles([first, second], 2), [first]);
  assert.deepEqual(getActiveTitles([first, second], 4.999), [first]);
  assert.deepEqual(getActiveTitles([first, second], 5), [second]);
  assert.deepEqual(getActiveTitles([first, second], Number.NaN), []);
});

test('maps title anchor and font size relative to output dimensions', () => {
  const title = createDefaultTitle('mapped');
  title.x = 25;
  title.y = 80;
  title.fontSize = 5;
  assert.deepEqual(mapTitleToOutput(title, 1920, 1080), {
    x: 480,
    y: 864,
    fontSize: 54,
    fontFamily: 'Arial, Helvetica, sans-serif',
  });
  title.fontFamily = 'monospace';
  assert.equal(mapTitleToOutput(title, 1080, 1920).fontFamily, '"Courier New", Courier, monospace');
});

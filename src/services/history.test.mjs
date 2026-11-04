import assert from 'node:assert/strict';
import test from 'node:test';
import { createHistory } from './history.ts';

test('starts with the initial snapshot and handles undo/redo at the boundaries', () => {
  const history = createHistory({ clips: [] });

  assert.deepEqual(history.getState(), { clips: [] });
  assert.equal(history.length, 1);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.deepEqual(history.undo(), { clips: [] });
  assert.deepEqual(history.redo(), { clips: [] });
});

test('undoes and redoes snapshots in order', () => {
  const history = createHistory({ value: 0 });
  history.push({ value: 1 });
  history.push({ value: 2 });

  assert.deepEqual(history.undo(), { value: 1 });
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), true);
  assert.deepEqual(history.undo(), { value: 0 });
  assert.deepEqual(history.redo(), { value: 1 });
  assert.deepEqual(history.redo(), { value: 2 });
  assert.equal(history.canRedo(), false);
});

test('pushing after undo discards the redo branch', () => {
  const history = createHistory('a');
  history.push('b');
  history.push('c');
  history.undo();

  assert.equal(history.push('branch'), 'branch');
  assert.equal(history.canRedo(), false);
  assert.equal(history.length, 3);
  assert.equal(history.undo(), 'b');
  assert.equal(history.redo(), 'branch');
});

test('evicts the oldest snapshots when the configured limit is exceeded', () => {
  const history = createHistory(0, { limit: 3 });
  history.push(1);
  history.push(2);
  history.push(3);

  assert.equal(history.length, 3);
  assert.equal(history.undo(), 2);
  assert.equal(history.undo(), 1);
  assert.equal(history.canUndo(), false);
  assert.equal(history.undo(), 1);
});

test('does not expose aliases to input snapshots, stored snapshots, or returned states', () => {
  const initial = { nested: { values: [1] } };
  const history = createHistory(initial);

  initial.nested.values.push(2);
  assert.deepEqual(history.getState(), { nested: { values: [1] } });

  const next = { nested: { values: [3] } };
  history.push(next);
  next.nested.values.push(4);
  const exposed = history.getState();
  exposed.nested.values.push(5);
  assert.deepEqual(history.getState(), { nested: { values: [3] } });

  history.undo();
  const initialState = history.getState();
  initialState.nested.values.push(6);
  assert.deepEqual(history.redo(), { nested: { values: [3] } });
  assert.deepEqual(history.undo(), { nested: { values: [1] } });
});

test('clear retains only the current snapshot or replaces it with an isolated snapshot', () => {
  const history = createHistory({ value: 0 });
  history.push({ value: 1 });
  history.undo();
  history.push({ value: 2 });
  history.clear();

  assert.equal(history.length, 1);
  assert.deepEqual(history.getState(), { value: 2 });
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);

  const replacement = { value: 3 };
  history.clear(replacement);
  replacement.value = 4;
  assert.deepEqual(history.getState(), { value: 3 });
});

test('rejects invalid snapshot limits', () => {
  assert.throws(() => createHistory(0, { limit: 0 }), RangeError);
  assert.throws(() => createHistory(0, { limit: 1.5 }), RangeError);
});

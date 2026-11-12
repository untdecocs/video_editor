export interface HistoryOptions {
  /** Maximum number of snapshots retained, including the current snapshot. */
  limit?: number;
}

export interface History<T> {
  /** Return an isolated copy of the current snapshot. */
  getState(): T;
  /** Add a snapshot and discard any redo branch. Consecutive matching keys coalesce. */
  push(snapshot: T, coalescingKey?: string): T;
  /** End the current coalescing group. */
  endCoalescing(): void;
  /** Move to the previous snapshot, or stay at the oldest snapshot. */
  undo(): T;
  /** Move to the next snapshot, or stay at the newest snapshot. */
  redo(): T;
  /** Keep only the current snapshot, or replace it when a snapshot is provided. */
  clear(snapshot?: T): T;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Number of snapshots currently retained. */
  readonly length: number;
}

const DEFAULT_LIMIT = 100;

function cloneSnapshot<T>(snapshot: T): T {
  return structuredClone(snapshot);
}

/**
 * Create an isolated, bounded undo/redo history.
 *
 * Snapshots are cloned on entry and whenever they are returned, so callers
 * cannot mutate history by changing an input or a returned value. Snapshots
 * must be supported by `structuredClone`.
 */
export function createHistory<T>(
  initialSnapshot: T,
  options: HistoryOptions = {},
): History<T> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('History limit must be a positive integer');
  }

  const snapshots = [cloneSnapshot(initialSnapshot)];
  let currentIndex = 0;
  let activeCoalescingKey: string | null = null;

  const history: History<T> = {
    getState() {
      return cloneSnapshot(snapshots[currentIndex]);
    },

    push(snapshot, coalescingKey) {
      const nextSnapshot = cloneSnapshot(snapshot);
      if (
        coalescingKey
        && activeCoalescingKey === coalescingKey
        && currentIndex === snapshots.length - 1
      ) {
        snapshots[currentIndex] = nextSnapshot;
        return cloneSnapshot(nextSnapshot);
      }

      snapshots.splice(currentIndex + 1);
      snapshots.push(nextSnapshot);
      if (snapshots.length > limit) {
        snapshots.shift();
      }
      currentIndex = snapshots.length - 1;
      activeCoalescingKey = coalescingKey ?? null;
      return cloneSnapshot(snapshots[currentIndex]);
    },

    endCoalescing() {
      activeCoalescingKey = null;
    },

    undo() {
      activeCoalescingKey = null;
      if (currentIndex > 0) {
        currentIndex -= 1;
      }
      return cloneSnapshot(snapshots[currentIndex]);
    },

    redo() {
      activeCoalescingKey = null;
      if (currentIndex < snapshots.length - 1) {
        currentIndex += 1;
      }
      return cloneSnapshot(snapshots[currentIndex]);
    },

    clear(snapshot) {
      const retainedSnapshot = cloneSnapshot(
        arguments.length === 0 ? snapshots[currentIndex] : snapshot as T,
      );
      snapshots.splice(0, snapshots.length, retainedSnapshot);
      currentIndex = 0;
      activeCoalescingKey = null;
      return cloneSnapshot(retainedSnapshot);
    },

    canUndo() {
      return currentIndex > 0;
    },

    canRedo() {
      return currentIndex < snapshots.length - 1;
    },

    get length() {
      return snapshots.length;
    },
  };

  return history;
}

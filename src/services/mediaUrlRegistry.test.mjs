import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaUrlRegistry } from './mediaUrlRegistry.ts';

test('revokes replaced, removed, and remaining project URLs exactly once', () => {
  let nextUrl = 0;
  const revoked = [];
  const registry = new MediaUrlRegistry({
    createObjectURL: () => `blob:test/${++nextUrl}`,
    revokeObjectURL: (url) => revoked.push(url),
  });
  const oldMedia = registry.create(new Blob(['old']));
  const removedMedia = registry.create(new Blob(['removed']));
  const restoredMedia = registry.create(new Blob(['restored']));

  registry.replace([restoredMedia]);
  registry.revoke(removedMedia);
  registry.revoke(removedMedia);
  registry.clear();
  registry.clear();

  assert.deepEqual(revoked, [oldMedia, removedMedia, restoredMedia]);
});

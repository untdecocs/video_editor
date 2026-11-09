import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForImageDecode } from './imageMetadata.ts';

test('sets the source and resolves when image decoding completes', async () => {
  const image = {
    src: '',
    async decode() {},
  };

  await waitForImageDecode(image, 'blob:image', 50);
  assert.equal(image.src, 'blob:image');
});

test('reports image decoding failures', async () => {
  const image = {
    src: '',
    async decode() {
      throw new Error('decoder details');
    },
  };

  await assert.rejects(waitForImageDecode(image, 'blob:invalid', 50), /could not decode this image/);
});

test('times out when image decoding never settles', async () => {
  const image = {
    src: '',
    decode: () => new Promise(() => {}),
  };

  await assert.rejects(waitForImageDecode(image, 'blob:pending', 10), /Timed out while decoding the image/);
});

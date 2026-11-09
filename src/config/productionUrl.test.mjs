import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCtaDestination, validateProductionUrl } from './productionUrl.js';

test('requires a valid absolute production HTTPS URL', () => {
  for (const value of [null, '', 'not-a-url', 'http://studio.example.com', 'https://localhost', 'https://127.0.0.1', 'https://preview.stillwave.com', 'https://stillwave.example.com']) {
    assert.equal(validateProductionUrl(value).valid, false, String(value));
  }
  assert.equal(validateProductionUrl('https://studio.stillwave.com').valid, true);
});

test('rejects credentials, query strings, and fragments in production URLs', () => {
  assert.equal(validateProductionUrl('https://user:pass@studio.stillwave.com').valid, false);
  assert.equal(validateProductionUrl('https://studio.stillwave.com/?preview=true').valid, false);
  assert.equal(validateProductionUrl('https://studio.stillwave.com/#home').valid, false);
});

test('requires CTA destination to use the configured production origin', () => {
  const productionUrl = 'https://studio.stillwave.com';
  assert.equal(validateCtaDestination('', productionUrl).valid, false);
  assert.equal(validateCtaDestination('/editor', productionUrl).valid, false);
  assert.equal(validateCtaDestination('https://other.stillwave.com/editor', productionUrl).valid, false);
  assert.equal(validateCtaDestination('http://studio.stillwave.com/editor', productionUrl).valid, false);
  assert.equal(validateCtaDestination('https://studio.stillwave.com/editor', productionUrl).valid, true);
});

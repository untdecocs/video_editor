const PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'invalid',
  'test',
]);

const DEVELOPMENT_LABELS = new Set([
  'dev',
  'development',
  'local',
  'localhost',
  'preview',
  'sandbox',
  'stage',
  'staging',
  'test',
]);

const DEVELOPMENT_LABEL_PATTERN = /(?:^|-)(?:dev|development|local|preview|sandbox|stage|staging|test)(?:-|$)/;

function isIpAddress(hostname) {
  return hostname.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

export function validateProductionUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value || !value) {
    return { valid: false, message: 'Production URL is missing.' };
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, message: 'Production URL must be an absolute HTTPS URL.' };
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const labels = hostname.split('.');
  if (url.protocol !== 'https:' || !hostname || url.username || url.password || url.search || url.hash) {
    return { valid: false, message: 'Production URL must be an absolute HTTPS URL without credentials, query parameters, or a fragment.' };
  }
  if (isIpAddress(hostname) || hostname === 'localhost' || hostname.endsWith('.localhost')
    || hostname.endsWith('.local') || hostname.endsWith('.test') || hostname.endsWith('.invalid')
    || PLACEHOLDER_HOSTS.has(hostname) || labels.some((label) => DEVELOPMENT_LABELS.has(label) || DEVELOPMENT_LABEL_PATTERN.test(label))
    || !hostname.includes('.')
    || /(?:your[-_]?domain|placeholder|replace[-_]?me|example)/i.test(hostname)) {
    return { valid: false, message: 'Production URL cannot be a placeholder, local, development, preview, or staging address.' };
  }
  return { valid: true, url };
}

export function validateCtaDestination(value, productionUrl) {
  if (typeof value !== 'string' || value.trim() !== value || !value) {
    return { valid: false, message: 'CTA destination is missing.' };
  }
  const production = validateProductionUrl(productionUrl);
  if (!production.valid) {
    return { valid: false, message: 'Configure a valid production URL before configuring the CTA destination.' };
  }
  let destination;
  try {
    destination = new URL(value);
  } catch {
    return { valid: false, message: 'CTA destination must be an absolute HTTPS URL.' };
  }
  if (destination.protocol !== 'https:' || destination.origin !== production.url.origin
    || destination.username || destination.password || destination.search || destination.hash) {
    return { valid: false, message: 'CTA destination must be an HTTPS path on the approved production origin, without credentials, query parameters, or a fragment.' };
  }
  return { valid: true, url: destination };
}

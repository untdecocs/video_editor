import production from '../../config/production.json';
import { validateCtaDestination, validateProductionUrl } from './productionUrl.js';

export const productionMetadata = production.metadata;

const productionUrl = validateProductionUrl(production.productionUrl);
const ctaDestination = validateCtaDestination(production.cta.destination, production.productionUrl);
const ctaLabel = String(production.cta.label ?? '').trim();

const releaseLinksEnabled = ['production', 'private-beta'].includes(import.meta.env.MODE);

export const approvedProductionLinks = releaseLinksEnabled
  && productionUrl.valid && ctaDestination.valid && ctaLabel.length > 0
  ? {
      home: productionUrl.url.href,
      cta: {
        label: ctaLabel,
        destination: ctaDestination.url.href,
      },
    }
  : null;

export function applyProductionMetadata() {
  document.title = productionMetadata.title;
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = productionMetadata.description;

  document.querySelector('link[rel="canonical"]')?.remove();
  if (import.meta.env.MODE === 'production' && productionUrl.valid) {
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = productionUrl.url.href;
    document.head.append(canonical);
  }
}

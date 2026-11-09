export type UrlValidation =
  | { valid: true; url: URL }
  | { valid: false; message: string };

export function validateProductionUrl(value: unknown): UrlValidation;
export function validateCtaDestination(value: unknown, productionUrl: unknown): UrlValidation;

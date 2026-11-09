import { validateMediaImport } from './media.ts';
import { validateMediaAgainstApprovedLimits } from './mediaLimitValidation.js';
import { PORTABLE_PACKAGE_SAFETY_LIMITS } from './mediaSafetyLimits.js';
import { validateProjectDocument, type ProjectDocument } from './project.ts';
import type { ProjectMediaBlobs, StoredProject } from './projectStorage.ts';

export const PROJECT_PACKAGE_VERSION = 1;
export const PROJECT_PACKAGE_EXTENSION = '.stillwave.json';
const PACKAGE_FORMAT = 'stillwave-project';
const { maxIndividualMediaBytes: MAX_MEDIA_BYTES, maxTotalProjectMediaBytes: MAX_TOTAL_MEDIA_BYTES } = PORTABLE_PACKAGE_SAFETY_LIMITS;

type ApprovedLimits = {
  status: string;
  maxIndividualMediaFileBytes: number | null;
  maxTotalProjectBytes: number | null;
  minimumExportDurationSeconds: number | null;
  maximumExportDurationSeconds: number | null;
};

type PackageRecord = {
  assetId: string;
  kind: 'audio' | 'image' | 'video';
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  base64: string;
};

type PackageDocument = {
  format: typeof PACKAGE_FORMAT;
  containerVersion: typeof PROJECT_PACKAGE_VERSION;
  document: ProjectDocument;
  media: { records: PackageRecord[] };
};

export class ProjectPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectPackageError';
  }
}

function assertRecord(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new ProjectPackageError(`${path} must be a plain object.`);
  }
  const record = value as Record<string, unknown>;
  const unexpected = Object.keys(record).find((key) => !keys.includes(key));
  if (unexpected) throw new ProjectPackageError(`${path} contains unsupported field "${unexpected}".`);
  const missing = keys.find((key) => !Object.prototype.hasOwnProperty.call(record, key));
  if (missing) throw new ProjectPackageError(`${path} is missing required field "${missing}".`);
  return record;
}

function validateFileName(fileName: unknown, expected: string): string {
  if (typeof fileName !== 'string' || fileName !== expected || !fileName.trim()
    || fileName === '.' || fileName === '..'
    || /[\\/:]/.test(fileName)
    || /[\u0000-\u001f\u007f-\u009f]/.test(fileName)
    || fileName.includes('..')) {
    throw new ProjectPackageError(`Media filename "${String(fileName)}" is unsafe or does not match project metadata. Use a simple filename without paths.`);
  }
  return fileName;
}

function validateSupportedMedia(fileName: string, mimeType: unknown, kind: PackageRecord['kind']): string {
  if (typeof mimeType !== 'string' || mimeType.trim() !== mimeType || /[\u0000-\u0020\u007f]/.test(mimeType)) {
    throw new ProjectPackageError(`Media "${fileName}" has an invalid MIME type.`);
  }
  const expectedKind = kind === 'audio' ? 'audio' : 'visual';
  const validation = validateMediaImport({ name: fileName, size: 1, type: mimeType }, expectedKind);
  if (!validation.valid || (kind !== 'audio' && validation.visualKind !== kind)) {
    throw new ProjectPackageError(`Media "${fileName}" has an unsupported or mismatched MIME type/format. Choose a supported ${kind} file.`);
  }
  return mimeType;
}

function cryptoSubtle(provider: Crypto | undefined): SubtleCrypto {
  if (!provider?.subtle) throw new ProjectPackageError('SHA-256 verification is unavailable in this browser.');
  return provider.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function base64Value(code: number): number {
  if (code >= 0x41 && code <= 0x5a) return code - 0x41;
  if (code >= 0x61 && code <= 0x7a) return code - 0x61 + 26;
  if (code >= 0x30 && code <= 0x39) return code - 0x30 + 52;
  if (code === 0x2b) return 62;
  if (code === 0x2f) return 63;
  return -1;
}

function fromBase64(value: unknown, fileName: string, expectedSize: number): Uint8Array {
  const invalid = () => new ProjectPackageError(`Media "${fileName}" has malformed or oversized base64 data.`);
  if (typeof value !== 'string' || value.length !== Math.ceil(expectedSize / 3) * 4) {
    throw invalid();
  }

  const remainder = expectedSize % 3;
  const padding = remainder === 0 ? 0 : remainder === 1 ? 2 : 1;
  const dataLength = value.length - padding;
  for (let index = 0; index < dataLength; index += 1) {
    if (base64Value(value.charCodeAt(index)) < 0) throw invalid();
  }
  for (let index = dataLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 0x3d) throw invalid();
  }
  if ((padding === 2 && (base64Value(value.charCodeAt(dataLength - 1)) & 0x0f) !== 0)
    || (padding === 1 && (base64Value(value.charCodeAt(dataLength - 1)) & 0x03) !== 0)) {
    throw new ProjectPackageError(`Media "${fileName}" has non-canonical base64 data.`);
  }

  const bytes = new Uint8Array(expectedSize);
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = base64Value(value.charCodeAt(index));
    const second = base64Value(value.charCodeAt(index + 1));
    bytes[outputIndex++] = (first << 2) | (second >> 4);
    if (value.charCodeAt(index + 2) !== 0x3d) {
      const third = base64Value(value.charCodeAt(index + 2));
      bytes[outputIndex++] = ((second & 0x0f) << 4) | (third >> 2);
      if (value.charCodeAt(index + 3) !== 0x3d) {
        const fourth = base64Value(value.charCodeAt(index + 3));
        bytes[outputIndex++] = ((third & 0x03) << 6) | fourth;
      }
    }
  }
  if (outputIndex !== expectedSize) {
    throw new ProjectPackageError(`Media "${fileName}" has malformed or oversized base64 data.`);
  }
  return bytes;
}

async function digest(bytes: Uint8Array, subtle: SubtleCrypto): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const hash = await subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function packageRecord(
  assetId: string,
  kind: PackageRecord['kind'],
  fileName: string,
  mimeType: string,
  blob: Blob,
  subtle: SubtleCrypto,
  currentProjectMediaBytes: number,
  approvedLimits?: ApprovedLimits,
): Promise<PackageRecord> {
  if (blob.size > MAX_MEDIA_BYTES) {
    throw new ProjectPackageError(`Media "${fileName}" exceeds this build's portable-package safety guard. Your open project is unchanged; try a smaller media copy and keep the original file.`);
  }
  const limitError = approvedLimits
    ? validateMediaAgainstApprovedLimits({ name: fileName, size: blob.size }, currentProjectMediaBytes, kind === 'audio' ? 'audio' : 'visual', approvedLimits)
    : null;
  if (limitError) throw new ProjectPackageError(limitError);
  validateFileName(fileName, fileName);
  validateSupportedMedia(fileName, mimeType, kind);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { assetId, kind, fileName, mimeType, size: bytes.length, sha256: await digest(bytes, subtle), base64: toBase64(bytes) };
}

/** Builds a portable JSON document containing the complete project and its media. */
export async function buildProjectPackage(
  documentValue: ProjectDocument,
  media: ProjectMediaBlobs,
  cryptoProvider: Crypto | undefined = globalThis.crypto,
  approvedLimits?: ApprovedLimits,
): Promise<string> {
  const document = validateProjectDocument(documentValue);
  const subtle = cryptoSubtle(cryptoProvider);
  if (!media || !media.assets || typeof media.assets !== 'object') {
    throw new ProjectPackageError('Project media collection is malformed.');
  }
  const records: PackageRecord[] = [];
  let totalSize = 0;
  if (document.audio) {
    if (!(media.audio instanceof Blob) || media.audio.size !== document.audio.size) {
      throw new ProjectPackageError(`Audio "${document.audio.fileName}" is missing or its size does not match project metadata.`);
    }
    if (totalSize + media.audio.size > MAX_TOTAL_MEDIA_BYTES) throw new ProjectPackageError('Project media exceeds this build’s portable-package safety guard. Your open project is unchanged; try smaller media copies and keep the originals.');
    records.push(await packageRecord(
      document.audio.id, 'audio', document.audio.fileName, document.audio.mimeType, media.audio, subtle, 0, approvedLimits,
    ));
    totalSize += media.audio.size;
  } else if (media.audio !== null) {
    throw new ProjectPackageError('Project has unexpected audio media.');
  }
  const expectedIds = new Set(document.assets.map((asset) => asset.id));
  const extraId = Object.keys(media.assets).find((id) => !expectedIds.has(id));
  if (extraId) throw new ProjectPackageError(`Unexpected media record "${extraId}" is not present in the project.`);
  for (const asset of document.assets) {
    const blob = media.assets[asset.id];
    if (!(blob instanceof Blob) || blob.size !== asset.size) {
      throw new ProjectPackageError(`Media "${asset.fileName}" is missing or its size does not match project metadata.`);
    }
    if (totalSize + blob.size > MAX_TOTAL_MEDIA_BYTES) throw new ProjectPackageError('Project media exceeds this build’s portable-package safety guard. Your open project is unchanged; try smaller media copies and keep the originals.');
    records.push(await packageRecord(asset.id, asset.kind, asset.fileName, asset.mimeType, blob, subtle, totalSize, approvedLimits));
    totalSize += blob.size;
  }
  const value: PackageDocument = {
    format: PACKAGE_FORMAT,
    containerVersion: PROJECT_PACKAGE_VERSION,
    document,
    media: { records },
  };
  return JSON.stringify(value);
}

/** Parses the fixed-version JSON package, validates its schema and verifies every SHA-256 digest. */
export async function parseProjectPackage(
  json: string,
  cryptoProvider: Crypto | undefined = globalThis.crypto,
  approvedLimits?: ApprovedLimits,
): Promise<StoredProject> {
  if (typeof json !== 'string') throw new ProjectPackageError('Project package must be UTF-8 JSON text.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new ProjectPackageError('Project package is not valid JSON. Choose a complete .stillwave.json file.');
  }
  const root = assertRecord(parsed, 'Project package', ['format', 'containerVersion', 'document', 'media']);
  if (root.format !== PACKAGE_FORMAT) throw new ProjectPackageError('This is not a Stillwave project package.');
  if (root.containerVersion !== PROJECT_PACKAGE_VERSION) {
    throw new ProjectPackageError(`Unsupported project package version ${String(root.containerVersion)}. Update the editor to import this package.`);
  }
  let document: ProjectDocument;
  try {
    document = validateProjectDocument(root.document);
  } catch (error) {
    throw new ProjectPackageError(`Project metadata is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  const media = assertRecord(root.media, 'Project media', ['records']);
  if (!Array.isArray(media.records)) throw new ProjectPackageError('Project media records must be an array.');
  const expected = new Map<string, { kind: PackageRecord['kind']; fileName: string; mimeType: string; size: number }>();
  if (document.audio) expected.set(document.audio.id, { kind: 'audio', ...document.audio });
  for (const asset of document.assets) expected.set(asset.id, { ...asset });
  const seen = new Set<string>();
  const blobs: Record<string, Blob> = {};
  let audio: Blob | null = null;
  const subtle = cryptoSubtle(cryptoProvider);
  let totalSize = 0;
  for (const [index, raw] of media.records.entries()) {
    const record = assertRecord(raw, `Media record ${index + 1}`, ['assetId', 'kind', 'fileName', 'mimeType', 'size', 'sha256', 'base64']);
    if (typeof record.assetId !== 'string' || seen.has(record.assetId)) {
      throw new ProjectPackageError(`Media record ${index + 1} has a missing or duplicate asset ID.`);
    }
    seen.add(record.assetId);
    const descriptor = expected.get(record.assetId);
    if (!descriptor) throw new ProjectPackageError(`Unexpected media record "${record.assetId}" is not present in project metadata.`);
    if (record.kind !== descriptor.kind) throw new ProjectPackageError(`Media "${descriptor.fileName}" has a kind that conflicts with project metadata.`);
    validateFileName(record.fileName, descriptor.fileName);
    const mimeType = validateSupportedMedia(descriptor.fileName, record.mimeType, descriptor.kind);
    if (mimeType !== descriptor.mimeType) throw new ProjectPackageError(`Media "${descriptor.fileName}" MIME type does not match project metadata.`);
    if (record.size !== descriptor.size || !Number.isSafeInteger(record.size) || (record.size as number) < 0
      || (record.size as number) > MAX_MEDIA_BYTES) {
      throw new ProjectPackageError(`Media "${descriptor.fileName}" declared byte length does not match project metadata or exceeds this build's import safety guard.`);
    }
    const limitError = approvedLimits
      ? validateMediaAgainstApprovedLimits(
        { name: descriptor.fileName, size: record.size as number },
        totalSize,
        descriptor.kind === 'audio' ? 'audio' : 'visual',
        approvedLimits,
      )
      : null;
    if (limitError) throw new ProjectPackageError(limitError);
    totalSize += record.size as number;
    if (totalSize > MAX_TOTAL_MEDIA_BYTES) throw new ProjectPackageError('Project media exceeds this build’s portable-package safety guard.');
    if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new ProjectPackageError(`Media "${descriptor.fileName}" has an invalid SHA-256 digest.`);
    }
    const bytes = fromBase64(record.base64, descriptor.fileName, record.size as number);
    if (await digest(bytes, subtle) !== record.sha256) {
      throw new ProjectPackageError(`Media "${descriptor.fileName}" failed its SHA-256 integrity check. Re-export the project file.`);
    }
    const blobBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(blobBuffer).set(bytes);
    const blob = new Blob([blobBuffer], { type: mimeType });
    if (descriptor.kind === 'audio') audio = blob;
    else blobs[record.assetId] = blob;
  }
  const missing = [...expected.keys()].find((id) => !seen.has(id));
  if (missing) throw new ProjectPackageError(`Project package is missing media record "${expected.get(missing)?.fileName ?? missing}".`);
  return { document, media: { audio, assets: blobs } };
}

export function sanitizeProjectPackageFilename(projectName: string): string {
  const safe = projectName.trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f-\u009f]/g, '-')
    .replace(/\.\.+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return `${safe || 'project'}${PROJECT_PACKAGE_EXTENSION}`;
}

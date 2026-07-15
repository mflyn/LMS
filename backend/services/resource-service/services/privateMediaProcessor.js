const sharp = require('sharp');
const {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRef,
  PDFStream,
  ParseSpeeds
} = require('pdf-lib');

const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');

const { MAX_MEDIA_BYTES } = MediaAsset;
const MAX_PDF_PAGES = 50;
const MAX_PDF_OBJECTS = 100000;
const MAX_PDF_DEPTH = 1000;

const MIME_BY_FORMAT = Object.freeze({
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
});
const PDF_PURPOSES = new Set(['task_attachment', 'mistake_question', 'mistake_answer']);
const MEDIA_PURPOSES = new Set(MediaAsset.MEDIA_PURPOSES);

const ACTIVE_KEYS = new Set([
  'AA',
  'AF',
  'EmbeddedFiles',
  'EF',
  'JavaScript',
  'JS',
  'Launch',
  'Movie',
  'OpenAction',
  'RichMedia',
  'Sound',
  'XFA',
  '3D',
  '3DA',
  '3DV'
]);
const ACTIVE_NAMES = new Set([
  'EmbeddedFile',
  'FileAttachment',
  'Filespec',
  'GoTo3DView',
  'GoToE',
  'GoToR',
  'Hide',
  'ImportData',
  'JavaScript',
  'Launch',
  'Movie',
  'Rendition',
  'ResetForm',
  'RichMedia',
  'SetOCGState',
  'Sound',
  'SubmitForm',
  'Thread',
  'Trans',
  'URI',
  '3D'
]);

const operationalError = (message, statusCode, code) => new AppError(
  message,
  statusCode,
  code,
  true,
  []
);
const typeNotAllowed = () => operationalError('Detected media type is not allowed', 400, 'MEDIA_TYPE_NOT_ALLOWED');
const mediaTooLarge = () => operationalError('Media exceeds the 10 MiB limit', 413, 'MEDIA_TOO_LARGE');
const invalidPdf = () => operationalError('PDF is malformed, encrypted, empty, or non-canonical', 400, 'PDF_INVALID');
const pageLimitExceeded = () => operationalError('PDF exceeds the 50 page limit', 400, 'PDF_PAGE_LIMIT_EXCEEDED');
const activePdfRejected = () => operationalError('PDF contains active or embedded content', 400, 'PDF_ACTIVE_CONTENT_REJECTED');

const assertBuffer = (bytes, maxBytes) => {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw typeNotAllowed();
  if (bytes.length > maxBytes) throw mediaTooLarge();
};

const startsWith = (bytes, signature) => signature.every((value, index) => bytes[index] === value);

const decodePdfNameToken = (token) => token.replace(/#([0-9a-f]{2})/gi, (_match, hex) => (
  String.fromCharCode(Number.parseInt(hex, 16))
));

const containsPdfName = (source, expectedName) => {
  const pattern = /\/((?:#[0-9a-fA-F]{2}|[^\s()<>{}\[\]/%#])+)/g;
  for (const match of source.matchAll(pattern)) {
    if (decodePdfNameToken(match[1]) === expectedName) return true;
  }
  return false;
};

const assertPdfContainer = (bytes) => {
  const source = bytes.toString('latin1');
  if (containsPdfName(source, 'ObjStm')) throw invalidPdf();

  const finalXref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(source);
  if (!finalXref) throw invalidPdf();
  const offset = Number(finalXref[1]);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= bytes.length) throw invalidPdf();

  const target = source.slice(offset, Math.min(bytes.length, offset + 4096));
  if (/^xref(?:\s|$)/.test(target)) return;
  if (!/^\d+\s+\d+\s+obj(?:\s|$)/.test(target) || !containsPdfName(target, 'XRef')) {
    throw invalidPdf();
  }
};

const detectFormat = (bytes) => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  throw typeNotAllowed();
};

const encodeImage = (pipeline, format) => {
  if (format === 'jpeg') return pipeline.jpeg({ quality: 90, mozjpeg: true });
  if (format === 'png') return pipeline.png({ compressionLevel: 9 });
  if (format === 'webp') return pipeline.webp({ quality: 90 });
  throw typeNotAllowed();
};

const canonicalizeImage = async (bytes, format, maxBytes) => {
  let metadata;
  try {
    metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  } catch (_error) {
    throw typeNotAllowed();
  }
  if (metadata.format !== format) throw typeNotAllowed();

  let buffer;
  try {
    buffer = await encodeImage(sharp(bytes, { failOn: 'error' }).rotate(), format).toBuffer();
  } catch (error) {
    if (error && error.isOperational) throw error;
    throw typeNotAllowed();
  }
  if (buffer.length > maxBytes) throw mediaTooLarge();
  return { buffer, mimeType: MIME_BY_FORMAT[format], sizeBytes: buffer.length };
};

const decodeName = (name) => name.decodeText();

const inspectPdfObject = (object, context, state, depth = 0) => {
  if (!object) return;
  if (depth > MAX_PDF_DEPTH || state.count >= MAX_PDF_OBJECTS) throw invalidPdf();

  if (object instanceof PDFRef) {
    const reference = object.toString();
    if (state.references.has(reference)) return;
    state.references.add(reference);
    state.count += 1;
    inspectPdfObject(context.lookup(object), context, state, depth + 1);
    return;
  }

  if (typeof object !== 'object' || state.objects.has(object)) return;
  state.objects.add(object);
  state.count += 1;

  if (object instanceof PDFName) {
    if (ACTIVE_NAMES.has(decodeName(object))) throw activePdfRejected();
    return;
  }
  if (object instanceof PDFStream) {
    inspectPdfObject(object.dict, context, state, depth + 1);
    return;
  }
  if (object instanceof PDFDict) {
    for (const [key, value] of object.entries()) {
      if (ACTIVE_KEYS.has(decodeName(key))) throw activePdfRejected();
      inspectPdfObject(value, context, state, depth + 1);
    }
    return;
  }
  if (object instanceof PDFArray) {
    for (let index = 0; index < object.size(); index += 1) {
      inspectPdfObject(object.get(index), context, state, depth + 1);
    }
  }
};

const inspectPdf = (document) => {
  const state = { count: 0, objects: new WeakSet(), references: new Set() };
  inspectPdfObject(document.catalog, document.context, state);
  for (const [reference, object] of document.context.enumerateIndirectObjects()) {
    inspectPdfObject(reference, document.context, state);
    inspectPdfObject(object, document.context, state);
  }
};

const loadPdf = async (bytes) => {
  try {
    assertPdfContainer(bytes);
    const document = await PDFDocument.load(bytes, {
      capNumbers: true,
      ignoreEncryption: false,
      parseSpeed: ParseSpeeds.Slow,
      throwOnInvalidObject: true,
      updateMetadata: false
    });
    if (document.isEncrypted) throw invalidPdf();
    return document;
  } catch (error) {
    if (error && error.isOperational) throw error;
    throw invalidPdf();
  }
};

const canonicalizePdf = async (bytes, maxBytes) => {
  const source = await loadPdf(bytes);
  let pageCount;
  try {
    pageCount = source.getPageCount();
  } catch (_error) {
    throw invalidPdf();
  }
  if (pageCount === 0) throw invalidPdf();
  if (pageCount > MAX_PDF_PAGES) throw pageLimitExceeded();

  try {
    inspectPdf(source);
  } catch (error) {
    if (error && error.isOperational) throw error;
    throw invalidPdf();
  }

  let buffer;
  try {
    const canonical = await PDFDocument.create();
    const pageIndexes = Array.from({ length: pageCount }, (_value, index) => index);
    const pages = await canonical.copyPages(source, pageIndexes);
    pages.forEach((page) => canonical.addPage(page));
    buffer = Buffer.from(await canonical.save({ addDefaultPage: false, useObjectStreams: false }));
  } catch (_error) {
    throw invalidPdf();
  }

  if (buffer.length > maxBytes) throw mediaTooLarge();
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw invalidPdf();

  const reparsed = await loadPdf(buffer);
  if (reparsed.getPageCount() !== pageCount) throw invalidPdf();
  inspectPdf(reparsed);
  return { buffer, mimeType: 'application/pdf', pageCount, sizeBytes: buffer.length };
};

const createPrivateMediaProcessor = ({ maxBytes = MAX_MEDIA_BYTES } = {}) => {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_MEDIA_BYTES) {
    throw new Error('maxBytes must be a positive integer within MAX_MEDIA_BYTES');
  }

  const prepare = async ({ bytes, purpose, originalName } = {}) => {
    assertBuffer(bytes, maxBytes);
    if (!MEDIA_PURPOSES.has(purpose)) throw typeNotAllowed();
    const format = detectFormat(bytes);
    if (format === 'pdf' && !PDF_PURPOSES.has(purpose)) throw typeNotAllowed();

    const canonical = format === 'pdf'
      ? await canonicalizePdf(bytes, maxBytes)
      : await canonicalizeImage(bytes, format, maxBytes);
    return {
      ...canonical,
      displayName: MediaAsset.sanitizeDisplayName(originalName)
    };
  };

  return { prepare };
};

module.exports = {
  ACTIVE_KEYS,
  ACTIVE_NAMES,
  MAX_PDF_PAGES,
  MIME_BY_FORMAT,
  PDF_PURPOSES,
  createPrivateMediaProcessor,
  detectFormat
};

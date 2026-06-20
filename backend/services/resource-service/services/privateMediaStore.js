const crypto = require('crypto');
const defaultFs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const MediaAsset = require('../models/MediaAsset');

const { MAX_MEDIA_BYTES, STORAGE_KEY_PATTERN } = MediaAsset;

const MIME_BY_FORMAT = Object.freeze({
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
});

const operationalError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  error.details = [];
  return error;
};

const validationError = (message) => operationalError(message, 400, 'VALIDATION_ERROR');
const notFoundError = () => operationalError('Media object not found', 404, 'RESOURCE_NOT_FOUND');
const conflictError = () => operationalError('Media storage key already exists', 409, 'RESOURCE_CONFLICT');

const assertInputBuffer = (input) => {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw validationError('Image file is required');
  }
  if (input.length > MAX_MEDIA_BYTES) {
    throw validationError('Image file exceeds the 10 MiB limit');
  }
};

const encode = (pipeline, format) => {
  if (format === 'jpeg') return pipeline.jpeg({ quality: 90, mozjpeg: true });
  if (format === 'png') return pipeline.png({ compressionLevel: 9 });
  if (format === 'webp') return pipeline.webp({ quality: 90 });
  throw validationError('Only JPEG, PNG, and WebP images are supported');
};

const sanitizeImage = async (input) => {
  assertInputBuffer(input);

  let metadata;
  try {
    metadata = await sharp(input, { failOn: 'error' }).metadata();
  } catch (error) {
    throw validationError('Image data is corrupt or unsupported');
  }

  const mimeType = MIME_BY_FORMAT[metadata.format];
  if (!mimeType) {
    throw validationError('Only JPEG, PNG, and WebP images are supported');
  }

  let buffer;
  try {
    buffer = await encode(sharp(input, { failOn: 'error' }).rotate(), metadata.format).toBuffer();
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') throw error;
    throw validationError('Image data is corrupt or unsupported');
  }
  if (buffer.length > MAX_MEDIA_BYTES) {
    throw validationError('Sanitized image exceeds the 10 MiB limit');
  }

  return { buffer, mimeType, sizeBytes: buffer.length };
};

const createPrivateMediaStore = ({
  root,
  fsPromises = defaultFs,
  randomUUID = crypto.randomUUID
} = {}) => {
  if (typeof root !== 'string' || root.trim() === '') {
    throw new Error('PRIVATE_MEDIA_ROOT is required');
  }
  const privateRoot = path.resolve(root);

  const initialize = async () => {
    await fsPromises.mkdir(privateRoot, { recursive: true, mode: 0o700 });
    await fsPromises.chmod(privateRoot, 0o700);
  };

  const resolveStoragePath = (storageKey) => {
    if (typeof storageKey !== 'string' || !STORAGE_KEY_PATTERN.test(storageKey)) {
      throw validationError('Invalid media storage key');
    }
    const resolved = path.resolve(privateRoot, storageKey);
    if (path.dirname(resolved) !== privateRoot) {
      throw validationError('Invalid media storage key');
    }
    return resolved;
  };

  const write = async (input) => {
    const sanitized = await sanitizeImage(input);
    const storageKey = randomUUID();
    const objectPath = resolveStoragePath(storageKey);
    const temporaryPath = path.join(privateRoot, `.${storageKey}.${process.pid}.tmp`);

    await initialize();
    let published = false;
    try {
      await fsPromises.writeFile(temporaryPath, sanitized.buffer, { flag: 'wx', mode: 0o600 });
      await fsPromises.chmod(temporaryPath, 0o600);
      await fsPromises.link(temporaryPath, objectPath);
      published = true;
      await fsPromises.unlink(temporaryPath);
    } catch (error) {
      await fsPromises.rm(temporaryPath, { force: true }).catch(() => undefined);
      if (published) await fsPromises.rm(objectPath, { force: true }).catch(() => undefined);
      if (error.code === 'EEXIST') throw conflictError();
      throw error;
    }

    return {
      storageKey,
      mimeType: sanitized.mimeType,
      sizeBytes: sanitized.sizeBytes
    };
  };

  const read = async (storageKey) => {
    const objectPath = resolveStoragePath(storageKey);
    try {
      return await fsPromises.readFile(objectPath);
    } catch (error) {
      if (error.code === 'ENOENT') throw notFoundError();
      throw error;
    }
  };

  const remove = async (storageKey) => {
    const objectPath = resolveStoragePath(storageKey);
    try {
      await fsPromises.unlink(objectPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  };

  return { initialize, read, remove, resolveStoragePath, write };
};

module.exports = {
  MAX_MEDIA_BYTES,
  MIME_BY_FORMAT,
  createPrivateMediaStore,
  sanitizeImage
};

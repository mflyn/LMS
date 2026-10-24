const crypto = require('crypto');
const defaultFs = require('fs/promises');
const path = require('path');
const MediaAsset = require('../models/MediaAsset');

const { MAX_MEDIA_BYTES, STORAGE_KEY_PATTERN } = MediaAsset;

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

const assertCanonicalBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw validationError('Canonical media bytes are required');
  }
  if (buffer.length > MAX_MEDIA_BYTES) {
    throw validationError('Canonical media exceeds the 10 MiB limit');
  }
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

  const writeCanonical = async (buffer) => {
    assertCanonicalBuffer(buffer);
    const storageKey = randomUUID();
    const objectPath = resolveStoragePath(storageKey);
    const temporaryPath = path.join(privateRoot, `.${storageKey}.${process.pid}.tmp`);

    await initialize();
    let published = false, temporaryOwned = false;
    try {
      const file = await fsPromises.open(temporaryPath, 'wx', 0o600);
      temporaryOwned = true;
      try {
        await file.writeFile(buffer);
        await file.chmod(0o600);
        await file.sync();
      } finally { await file.close(); }
      await fsPromises.link(temporaryPath, objectPath);
      published = true;
      await fsPromises.unlink(temporaryPath);
      temporaryOwned = false;
      // A caller may persist metadata only after bytes and the published directory entry are durable.
      await flushDirectory();
    } catch (error) {
      const cleanupErrors = [];
      for (const ownedPath of [temporaryOwned && temporaryPath, published && objectPath].filter(Boolean)) {
        try { await fsPromises.rm(ownedPath, { force: true }); } catch (cause) { cleanupErrors.push(cause); }
      }
      if (temporaryOwned || published) {
        try { await flushDirectory(); } catch (cause) { cleanupErrors.push(cause); }
      }
      if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], 'Media write and cleanup failed');
      if (error.code === 'EEXIST') throw conflictError();
      throw error;
    }

    return { storageKey };
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

  const flushDirectory = async () => {
    const directory = await fsPromises.open(privateRoot, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  };

  const syncDirectory = async () => {
    const stat = await fsPromises.lstat(privateRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await fsPromises.realpath(privateRoot) !== privateRoot) {
      throw new Error('Invalid private media root');
    }
    await flushDirectory();
  };

  return { initialize, read, remove, syncDirectory, resolveStoragePath, writeCanonical };
};

module.exports = {
  MAX_MEDIA_BYTES,
  createPrivateMediaStore
};

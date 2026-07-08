const crypto = require('crypto');
const defaultFs = require('fs/promises');
const multer = require('multer');
const path = require('path');

const { AppError } = require('../../../common/middleware/errorTypes');
const { MAX_MEDIA_BYTES } = require('../models/MediaAsset');

const validationError = (message) => new AppError(
  message,
  400,
  'VALIDATION_ERROR',
  true,
  []
);

const createPrivateMediaUpload = ({
  privateRoot,
  fsPromises = defaultFs,
  randomUUID = crypto.randomUUID
} = {}) => {
  if (typeof privateRoot !== 'string' || privateRoot.trim() === '') {
    throw new Error('PRIVATE_MEDIA_ROOT is required');
  }

  const incomingRoot = path.join(path.resolve(privateRoot), '.incoming');
  const ensureIncomingRoot = async () => {
    await fsPromises.mkdir(incomingRoot, { recursive: true, mode: 0o700 });
    await fsPromises.chmod(incomingRoot, 0o700);
  };

  const storage = multer.diskStorage({
    destination: (req, file, callback) => {
      ensureIncomingRoot().then(() => callback(null, incomingRoot), callback);
    },
    filename: (req, file, callback) => callback(null, `${randomUUID()}.upload`)
  });
  const parseSingle = multer({
    storage,
    limits: { fileSize: MAX_MEDIA_BYTES, files: 1, fields: 2 }
  }).single('file');

  const singleImage = (req, res, next) => {
    parseSingle(req, res, (error) => {
      if (error) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? 'Image file exceeds the 10 MiB limit'
          : 'Invalid media upload';
        return next(validationError(message));
      }
      if (!req.file) return next(validationError('Image file is required'));
      return next();
    });
  };

  const removeTemporary = async (temporaryPath) => {
    if (!temporaryPath) return false;
    const resolved = path.resolve(temporaryPath);
    if (path.dirname(resolved) !== incomingRoot) {
      throw validationError('Invalid temporary media path');
    }
    try {
      await fsPromises.unlink(resolved);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  };

  return { incomingRoot, removeTemporary, singleImage };
};

module.exports = {
  createPrivateMediaUpload
};

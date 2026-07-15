const defaultFs = require('fs/promises');
const express = require('express');

const encodeDispositionFilename = (displayName) => encodeURIComponent(displayName)
  .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const createMediaRouter = ({
  authenticate,
  fsPromises = defaultFs,
  mediaService,
  upload
} = {}) => {
  if (typeof authenticate !== 'function') throw new Error('Media authenticate middleware is required');
  if (!mediaService || typeof mediaService.upload !== 'function'
    || typeof mediaService.deleteMedia !== 'function'
    || typeof mediaService.issueAccess !== 'function'
    || typeof mediaService.readContent !== 'function') {
    throw new Error('mediaService is required');
  }
  if (!upload || typeof upload.singleImage !== 'function' || typeof upload.removeTemporary !== 'function') {
    throw new Error('private media upload middleware is required');
  }

  const router = express.Router();
  router.get('/:mediaId/content', asyncRoute(async (req, res) => {
    const content = await mediaService.readContent({
      mediaId: req.params.mediaId,
      path: `${req.baseUrl}${req.path}`,
      expires: req.query.expires,
      nonce: req.query.nonce,
      signature: req.query.signature
    });
    const disposition = content.mimeType === 'application/pdf'
      ? `attachment; filename*=UTF-8''${encodeDispositionFilename(content.displayName)}`
      : 'inline';
    res.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': disposition,
      'Content-Type': content.mimeType,
      'X-Content-Type-Options': 'nosniff'
    });
    res.status(200).send(content.bytes);
  }));

  router.use(authenticate);
  router.get('/:mediaId/access', asyncRoute(async (req, res) => {
    const { access, media } = await mediaService.issueAccess({
      identity: req.user,
      mediaId: req.params.mediaId
    });
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { access, media } });
  }));

  router.delete('/:mediaId', asyncRoute(async (req, res) => {
    await mediaService.deleteMedia({ identity: req.user, mediaId: req.params.mediaId });
    res.status(204).send();
  }));

  router.post('/', upload.singleImage, asyncRoute(async (req, res) => {
    let media;
    try {
      const bytes = await fsPromises.readFile(req.file.path);
      media = await mediaService.upload({
        identity: req.user,
        suppliedChildId: req.body.childId,
        purpose: req.body.purpose,
        bytes,
        originalName: req.file.originalname
      });
    } finally {
      await upload.removeTemporary(req.file && req.file.path);
    }

    const logger = req.app && req.app.locals && req.app.locals.logger;
    if (logger) {
      logger.info('Family media operation', {
        operation: 'media.upload',
        result: 'created',
        familyId: req.user.familyId,
        mediaId: media.mediaId,
        purpose: media.purpose
      });
    }
    res.status(201).json({ success: true, data: { media } });
  }));

  return router;
};

module.exports = {
  createMediaRouter
};

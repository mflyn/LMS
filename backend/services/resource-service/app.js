const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { createLogger } = require('../../common/config/logger');
const { errorHandler, requestTracker, requestTimeout } = require('../../common/middleware/errorHandler');
const resourcesRouter = require('./routes/resources');
const recommendationsRouter = require('./routes/recommendations');
const collectionsRouter = require('./routes/collections');
const FamilyUser = require('./models/FamilyUser');

const LEGACY_UPLOAD_ROOT = path.join(__dirname, 'uploads');

const createLegacyUpload = () => multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => callback(null, LEGACY_UPLOAD_ROOT),
    filename: (req, file, callback) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, suffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'audio/mpeg'
    ]);
    callback(allowedTypes.has(file.mimetype) ? null : new Error('Unsupported file type'), allowedTypes.has(file.mimetype));
  }
});

const createApp = ({
  internalMediaRouter = null,
  logger = createLogger('resource-service'),
  mediaSecurity = { profile: 'trusted-local', scanner: null },
  mediaRouter = null,
  userModel = FamilyUser
} = {}) => {
  if (!mediaSecurity || !['trusted-local', 'secure-production'].includes(mediaSecurity.profile)) {
    throw new Error('valid media security state is required');
  }
  if (mediaSecurity.profile === 'secure-production'
    && (!mediaSecurity.scanner || typeof mediaSecurity.scanner.ping !== 'function')) {
    throw new Error('secure-production scanner is required');
  }
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'resource-service';
  app.locals.upload = createLegacyUpload();
  app.locals.userModel = userModel;
  app.locals.mediaSecurity = Object.freeze({
    profile: mediaSecurity.profile,
    scanner: mediaSecurity.profile === 'secure-production' ? mediaSecurity.scanner : null
  });

  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);
  app.use(requestTimeout());
  app.use('/uploads', express.static(LEGACY_UPLOAD_ROOT));
  if (internalMediaRouter) {
    app.use('/api/internal/media/references', internalMediaRouter);
  }
  if (mediaRouter) app.use('/api/media', mediaRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/resources/collections', collectionsRouter);
  app.use('/api/resources', resourcesRouter);
  app.get('/health', async (req, res) => {
    const security = req.app.locals.mediaSecurity;
    if (security.profile === 'trusted-local') {
      res.status(200).json({
        status: 'ok',
        service: 'resource-service',
        mediaSecurity: { profile: 'trusted-local' }
      });
      return;
    }

    try {
      await security.scanner.ping();
      res.status(200).json({
        status: 'ok',
        service: 'resource-service',
        mediaSecurity: { profile: 'secure-production', scanner: 'healthy' }
      });
    } catch (_error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'resource-service',
        mediaSecurity: { profile: 'secure-production', scanner: 'unavailable' }
      });
    }
  });
  app.use(errorHandler);

  return app;
};

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
module.exports.LEGACY_UPLOAD_ROOT = LEGACY_UPLOAD_ROOT;

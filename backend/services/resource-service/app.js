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
  mediaRouter = null,
  userModel = FamilyUser
} = {}) => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'resource-service';
  app.locals.upload = createLegacyUpload();
  app.locals.userModel = userModel;

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
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'resource-service' });
  });
  app.use(errorHandler);

  return app;
};

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
module.exports.LEGACY_UPLOAD_ROOT = LEGACY_UPLOAD_ROOT;

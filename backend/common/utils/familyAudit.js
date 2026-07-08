const logFamilyOperation = (req, fields) => {
  const logger = req.app && req.app.locals && req.app.locals.logger;
  if (!logger || typeof logger.info !== 'function') return;
  logger.info('Family operation', { requestId: req.requestId, ...fields });
};

module.exports = { logFamilyOperation };

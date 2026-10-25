const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { AppError } = require('../../../common/middleware/errorTypes');

// Opt-in only. Production keeps its existing media router until separately approved.
const createCompletionMediaPrivacyRouter = ({ privacyService } = {}) => {
  if (typeof privacyService?.deleteMedia !== 'function') throw new TypeError('Completion privacy service is required');
  const router = express.Router();
  router.delete('/:mediaId', authenticateGateway, async (req, res, next) => {
    try {
      if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) {
        throw new AppError('DELETE does not accept a request body', 400, 'VALIDATION_ERROR', true, []);
      }
      await privacyService.deleteMedia({ identity: req.user, mediaId: req.params.mediaId });
      res.status(204).send();
    } catch (cause) {
      next(cause);
    }
  });
  return router;
};

module.exports = { createCompletionMediaPrivacyRouter };

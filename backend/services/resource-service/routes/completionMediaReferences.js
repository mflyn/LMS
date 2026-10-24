const express = require('express');

const ACTIONS = ['prepare', 'commit', 'abort', 'status', 'unbind'];

// Mounted only through the enabled protocol composition, never by legacy production.
const createCompletionMediaReferencesRouter = ({ credential, operationService } = {}) => {
  if (typeof credential !== 'function') throw new Error('Media reference credential is required');
  if (!operationService || ACTIONS.some(action => typeof operationService[action] !== 'function')) {
    throw new Error('Completion media operation service is required');
  }
  const router = express.Router();
  for (const action of ACTIONS) {
    router.post('/' + action, credential, (req, res, next) => {
      Promise.resolve().then(() => operationService[action](req.body))
        .then(data => res.status(200).json({ success: true, data }))
        .catch(next);
    });
  }
  return router;
};

module.exports = { createCompletionMediaReferencesRouter };

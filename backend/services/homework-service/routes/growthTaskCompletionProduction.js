const express = require('express');
const Task = require('../models/GrowthTask');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { sendFamilyError } = require('../../../common/utils/familyResponse');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const { AppError } = require('../../../common/middleware/errorTypes');
const { assertParentIdentity, authorizeParentChild, authorizeParentTask } = require('../services/growthTaskCompletionParentAccess');
const { parseGrowthTaskCreate, parseGrowthTaskPatch, entriesToMongoSet, validateGrowthTaskValues } = require('../services/growthTaskPatch');
const { ID, matches, error, invalid, pending } = require('../services/growthTaskCompletionCommand');
const { taskView } = require('../services/growthTaskCompletionReadService');
const { createGrowthTaskCompletionRouter } = require('./growthTaskCompletion');
const { createGrowthTaskCompletionReadRouter } = require('./growthTaskCompletionRead');
const { createGrowthTaskCompletionMutationRouter } = require('./growthTaskCompletionMutation');
const { createGrowthTaskCompletionRecoveryRouter } = require('./growthTaskCompletionRecovery');

const createGrowthTaskCompletionProductionRouter = ({ completionService, confirmationService, readService,
  mutationService, attachmentMediaService, transactionRunner } = {}) => {
  if (typeof attachmentMediaService?.create !== 'function' || typeof attachmentMediaService?.mutate !== 'function'
    || typeof transactionRunner !== 'function') throw new TypeError('Isolated attachment service and transaction runner are required');
  const router = express.Router();
  const authorizedRead = async work => {
    try {
      return await transactionRunner(session => {
        if (!session?.inTransaction()) throw pending();
        return work(session);
      });
    } catch (cause) {
      if (cause instanceof AppError && cause.statusCode < 500) throw cause;
      throw pending();
    }
  };
  const parse = (parser, body) => {
    if (body && Object.prototype.hasOwnProperty.call(body, 'repeatRule')) throw error(400, 'REPEAT_RULE_NOT_SUPPORTED');
    try { return parser(body); } catch (_cause) { throw invalid(); }
  };
  const validate = async values => {
    try { await validateGrowthTaskValues(Task, values); } catch (_cause) { throw invalid(); }
  };
  // The legacy material recovery contract uses an object details.resourceId, not an array.
  const materialHandler = (action, status) => async (req, res, next) => {
    try { res.status(status).json(await action(req)); } catch (cause) {
      if (cause instanceof AppError) return next(cause);
      if (cause?.name === 'ValidationError' || cause?.name === 'CastError') return next(invalid());
      if ([400, 403, 404, 409, 503].includes(cause?.status) && /^[A-Z][A-Z0-9_]{0,79}$/.test(cause.code || '')) {
        const details = cause.code === 'MEDIA_REFERENCE_PENDING' && matches(cause.details?.resourceId, ID)
          ? { resourceId: cause.details.resourceId } : [];
        return sendFamilyError(res, cause.status, cause.code, cause.code, details);
      }
      return next(pending());
    }
  };
  router.post('/', authenticateGateway, materialHandler(async req => {
    assertParentIdentity(req.user);
    const parsed = parse(parseGrowthTaskCreate, req.body);
    const access = await authorizedRead(session => authorizeParentChild(req.user, parsed.taskInput.childId, session));
    const taskInput = { ...parsed.taskInput, familyId: access.familyId, createdByParentId: req.user.id };
    await validate(taskInput);
    const task = await attachmentMediaService.create({ taskInput, attachmentMediaIds: parsed.attachmentMediaIds || [] });
    logFamilyOperation(req, { operation: 'task.attachments.create', result: 'bound',
      familyId: String(task.familyId), childId: String(task.childId), taskId: String(task._id) });
    return { success: true, data: { task: taskView(task) } };
  }, 201));

  router.use(createGrowthTaskCompletionRecoveryRouter({ completionService }));
  router.use(createGrowthTaskCompletionReadRouter({ readService }));
  router.use(createGrowthTaskCompletionRouter({ completionService, confirmationService }));
  // Dispatch by a supported field, never by a handler failure or a partial update.
  router.patch('/:taskId', (req, res, next) => {
    if (!req.body || !Object.prototype.hasOwnProperty.call(req.body, 'attachmentMediaIds')) return next('route');
    return authenticateGateway(req, res, next);
  }, materialHandler(async request => {
      const task = await authorizedRead(session => authorizeParentTask(request.user, request.params.taskId, session));
      const parsed = parse(parseGrowthTaskPatch, request.body);
      await validate(entriesToMongoSet(parsed.entries));
      if (task.status !== 'pending') throw error(409, 'TASK_STATE_CONFLICT');
      const updated = await attachmentMediaService.mutate({ task, taskPatch: parsed.entries,
        attachmentMediaIds: parsed.attachmentMediaIds });
      logFamilyOperation(request, { operation: 'task.attachments.patch', result: 'bound',
        familyId: String(updated.familyId), childId: String(updated.childId), taskId: String(updated._id) });
      return { success: true, data: { task: taskView(updated) } };
  }, 200));
  router.use(createGrowthTaskCompletionMutationRouter({ mutationService }));
  return router;
};

module.exports = { createGrowthTaskCompletionProductionRouter };

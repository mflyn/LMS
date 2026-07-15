const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const { authenticateGateway } = require('../../../common/middleware/auth');
const { isObjectId, resolveChildAccess } = require('../../../common/utils/familyAccess');
const { parsePagination, sendFamilyError } = require('../../../common/utils/familyResponse');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const FamilyMistake = require('../models/FamilyMistake');
const FamilyMistakeStateEvent = require('../models/FamilyMistakeStateEvent');
const {
  FamilyMistakePatchError,
  parseFamilyMistakeInput,
  splitMediaPatch,
  stateChangedBy
} = require('../services/familyMistakePatch');

const BOOLEAN_FILTERS = ['corrected', 'reviewed', 'mastered'];
const REVIEW_STATUSES = ['pending', 'reviewed', 'mastered'];
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sendError = (res, status, code, message, details) => sendFamilyError(res, status, code, message, details);
const sendServiceError = (res, error) => {
  if (!error || !error.status || !error.code) return false;
  sendFamilyError(res, error.status, error.code, error.message, error.details || []);
  return true;
};

const stateEventUnavailable = () => Object.assign(
  new Error('Mistake state event store is unavailable'),
  { status: 503, code: 'STATE_EVENT_UNAVAILABLE' }
);

const booleanFromQuery = (value) => {
  if (value === undefined) return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  const error = new Error('Boolean filters must be true or false');
  error.code = 'VALIDATION_ERROR';
  throw error;
};

const isValidLocalDate = (value) => {
  if (!LOCAL_DATE_PATTERN.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
};

const applyReviewStatusFilter = (filter, reviewStatus) => {
  if (reviewStatus === undefined) return;
  if (!REVIEW_STATUSES.includes(reviewStatus)) {
    const error = new Error('Invalid reviewStatus');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  if (reviewStatus === 'pending') {
    filter.mastered = false;
    filter.reviewed = false;
  } else if (reviewStatus === 'reviewed') {
    filter.mastered = false;
    filter.reviewed = true;
  } else {
    filter.mastered = true;
  }
};

const applyReviewReminderRange = (filter, from, to) => {
  if (from !== undefined && !isValidLocalDate(from)) {
    const error = new Error('Invalid reviewReminderFrom');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  if (to !== undefined && !isValidLocalDate(to)) {
    const error = new Error('Invalid reviewReminderTo');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  if (from !== undefined && to !== undefined && from > to) {
    const error = new Error('reviewReminderFrom must not be later than reviewReminderTo');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  if (from !== undefined || to !== undefined) {
    filter.reviewReminderDate = {};
    if (from !== undefined) filter.reviewReminderDate.$gte = from;
    if (to !== undefined) filter.reviewReminderDate.$lte = to;
  }
};

const mediaIdsFor = (mistake, arrayField, aliasField) => {
  if (Array.isArray(mistake[arrayField])) return mistake[arrayField].map((mediaId) => mediaId.toString());
  return mistake[aliasField] ? [mistake[aliasField].toString()] : [];
};

const mistakeView = (mistake) => {
  const questionMediaIds = mediaIdsFor(mistake, 'questionMediaIds', 'questionMediaId');
  const childAnswerMediaIds = mediaIdsFor(mistake, 'childAnswerMediaIds', 'childAnswerMediaId');
  return {
    mistakeId: mistake._id.toString(),
    familyId: mistake.familyId.toString(),
    childId: mistake.childId.toString(),
    dimension: mistake.dimension,
    subject: mistake.subject,
    knowledgePointId: mistake.knowledgePointId ? mistake.knowledgePointId.toString() : undefined,
    knowledgePointName: mistake.knowledgePointName,
    reason: mistake.reason,
    correctAnswer: mistake.correctAnswer,
    parentNote: mistake.parentNote,
    childExplanation: mistake.childExplanation,
    reviewReminderDate: mistake.reviewReminderDate,
    corrected: mistake.corrected,
    reviewed: mistake.reviewed,
    mastered: mistake.mastered,
    questionMediaIds,
    childAnswerMediaIds,
    questionMediaId: questionMediaIds[0],
    childAnswerMediaId: childAnswerMediaIds[0],
    createdBy: mistake.createdBy.toString(),
    updatedBy: mistake.updatedBy.toString(),
    createdAt: mistake.createdAt,
    updatedAt: mistake.updatedAt
  };
};

const withValidationErrors = (res, error) => {
  if (error instanceof FamilyMistakePatchError) {
    return sendError(res, error.status, error.code, error.message);
  }
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.code === 'VALIDATION_ERROR') {
    return sendError(res, 400, 'VALIDATION_ERROR', error.message);
  }
  return null;
};

const createFamilyMistakesRouter = ({
  MistakeModel = FamilyMistake,
  StateEventModel = FamilyMistakeStateEvent,
  familyMistakeMediaService = null,
  now = () => new Date(),
  runTransaction = (work) => runMongoTransaction({ mongooseInstance: mongoose, work })
} = {}) => {
  const router = express.Router();

  router.post('/', authenticateGateway, async (req, res) => {
    try {
      if (!['parent', 'student'].includes(req.user.role)) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Role cannot create mistakes');
      }

      const data = parseFamilyMistakeInput({
        body: req.body,
        role: req.user.role,
        operation: 'create'
      });
      const { mistakePatch: mistakeInput, mediaPatch, hasMediaMutation } = splitMediaPatch(data);
      if (hasMediaMutation && !familyMistakeMediaService) {
        return sendError(res, 400, 'MEDIA_NOT_ENABLED', 'Private media is not enabled yet');
      }

      const childId = req.user.role === 'student' ? req.user.childId || req.user.id : mistakeInput.childId;
      if (!childId || !mistakeInput.subject || !mistakeInput.reason) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'childId, subject and reason are required');
      }
      if (req.user.role === 'student' && mistakeInput.childId && mistakeInput.childId.toString() !== childId.toString()) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot create a mistake for another child');
      }

      const access = await resolveChildAccess(req.user, childId);
      if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');

      delete mistakeInput.childId;
      const sourceInput = {
        ...mistakeInput,
        familyId: access.familyId,
        childId,
        createdBy: req.user.id,
        updatedBy: req.user.id
      };

      if (hasMediaMutation) {
        const mistake = await familyMistakeMediaService.create({
          mistakeInput: sourceInput,
          mediaPatch
        });
        return res.status(201).json({ success: true, data: { mistake: mistakeView(mistake) } });
      }

      const mistake = await runTransaction(async (session) => {
        const [createdMistake] = await MistakeModel.create([sourceInput], { session });
        try {
          await StateEventModel.create([{
            familyId: createdMistake.familyId,
            childId: createdMistake.childId,
            mistakeId: createdMistake._id,
            reviewed: createdMistake.reviewed,
            mastered: createdMistake.mastered,
            reviewReminderDate: createdMistake.reviewReminderDate,
            effectiveAt: now(),
            operationId: crypto.randomUUID()
          }], { session });
        } catch (error) {
          throw stateEventUnavailable();
        }
        return createdMistake;
      });

      return res.status(201).json({ success: true, data: { mistake: mistakeView(mistake) } });
    } catch (error) {
      if (sendServiceError(res, error)) return undefined;
      const handled = withValidationErrors(res, error);
      if (handled) return handled;
      return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  router.get('/', authenticateGateway, async (req, res) => {
    try {
      const queryFields = [
        'childId',
        'subject',
        'reason',
        'corrected',
        'reviewed',
        'mastered',
        'reviewStatus',
        'reviewReminderFrom',
        'reviewReminderTo',
        'page',
        'pageSize'
      ];
      const forbiddenQuery = Object.keys(req.query).filter((field) => !queryFields.includes(field));
      if (forbiddenQuery.length > 0) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Unknown mistake filter');
      }

      const childId = req.user.role === 'student' ? req.user.childId || req.user.id : req.query.childId;
      if (!childId) return sendError(res, 400, 'VALIDATION_ERROR', 'childId is required');
      const access = await resolveChildAccess(req.user, childId);
      if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');

      let pagination;
      try {
        pagination = parsePagination(req.query);
      } catch (error) {
        return sendError(res, 400, error.code, error.message);
      }

      const filter = { familyId: access.familyId, childId };
      if (req.query.subject) filter.subject = req.query.subject;
      if (req.query.reason) filter.reason = req.query.reason;
      if (req.query.reviewStatus !== undefined
        && (req.query.reviewed !== undefined || req.query.mastered !== undefined)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'reviewStatus cannot be combined with reviewed or mastered');
      }
      BOOLEAN_FILTERS.forEach((field) => {
        const parsed = booleanFromQuery(req.query[field]);
        if (parsed !== undefined) filter[field] = parsed;
      });
      applyReviewStatusFilter(filter, req.query.reviewStatus);
      applyReviewReminderRange(filter, req.query.reviewReminderFrom, req.query.reviewReminderTo);

      const [mistakes, total] = await Promise.all([
        MistakeModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(pagination.skip).limit(pagination.pageSize),
        MistakeModel.countDocuments(filter)
      ]);

      return res.json({
        success: true,
        data: {
          items: mistakes.map(mistakeView),
          page: pagination.page,
          pageSize: pagination.pageSize,
          total
        }
      });
    } catch (error) {
      const handled = withValidationErrors(res, error);
      if (handled) return handled;
      return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  router.get('/:mistakeId', authenticateGateway, async (req, res) => {
    try {
      if (!isObjectId(req.params.mistakeId)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid mistakeId');
      }
      const mistake = await MistakeModel.findById(req.params.mistakeId)
        .select('+mediaReferenceState +mediaBindingOperationId +mediaPendingPatch');
      if (!mistake) return sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Mistake not found');
      const access = await resolveChildAccess(req.user, mistake.childId.toString());
      if (!access || access.familyId.toString() !== mistake.familyId.toString()) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this mistake');
      }
      const viewSource = familyMistakeMediaService && mistake.mediaReferenceState === 'pending'
        ? await familyMistakeMediaService.resume(mistake._id.toString())
        : mistake;
      return res.json({ success: true, data: { mistake: mistakeView(viewSource) } });
    } catch (error) {
      if (sendServiceError(res, error)) return undefined;
      return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  router.patch('/:mistakeId', authenticateGateway, async (req, res) => {
    try {
      if (!isObjectId(req.params.mistakeId)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid mistakeId');
      }
      const mistake = await MistakeModel.findById(req.params.mistakeId);
      if (!mistake) return sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Mistake not found');
      const access = await resolveChildAccess(req.user, mistake.childId.toString());
      if (!access || access.familyId.toString() !== mistake.familyId.toString()) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this mistake');
      }

      const data = parseFamilyMistakeInput({
        body: req.body,
        role: req.user.role,
        operation: 'patch'
      });
      const { mistakePatch, mediaPatch, hasMediaMutation } = splitMediaPatch(data);
      if (hasMediaMutation && !familyMistakeMediaService) {
        return sendError(res, 400, 'MEDIA_NOT_ENABLED', 'Private media is not enabled yet');
      }
      if (hasMediaMutation) {
        mistakePatch.updatedBy = req.user.id;
        const updatedMistake = await familyMistakeMediaService.mutate({
          mistake,
          mistakePatch,
          mediaPatch
        });
        return res.json({ success: true, data: { mistake: mistakeView(updatedMistake) } });
      }

      const changedState = stateChangedBy(mistakePatch);
      let updatedMistake = mistake;
      if (changedState) {
        updatedMistake = await runTransaction(async (session) => {
          const transactionalMistake = await MistakeModel.findById(mistake._id).session(session);
          if (!transactionalMistake) {
            const error = new Error('Mistake not found');
            error.status = 404;
            error.code = 'RESOURCE_NOT_FOUND';
            throw error;
          }
          Object.keys(mistakePatch).forEach((field) => {
            transactionalMistake[field] = mistakePatch[field];
          });
          transactionalMistake.updatedBy = req.user.id;
          await transactionalMistake.validate({ validateModifiedOnly: true });
          await transactionalMistake.save({ validateModifiedOnly: true, session });
          try {
            await StateEventModel.create([{
              familyId: transactionalMistake.familyId,
              childId: transactionalMistake.childId,
              mistakeId: transactionalMistake._id,
              reviewed: transactionalMistake.reviewed,
              mastered: transactionalMistake.mastered,
              reviewReminderDate: transactionalMistake.reviewReminderDate,
              effectiveAt: now(),
              operationId: crypto.randomUUID()
            }], { session });
          } catch (error) {
            throw stateEventUnavailable();
          }
          return transactionalMistake;
        });
      } else {
        Object.keys(mistakePatch).forEach((field) => {
          mistake[field] = mistakePatch[field];
        });
        mistake.updatedBy = req.user.id;
        await mistake.validate({ validateModifiedOnly: true });
        await mistake.save({ validateModifiedOnly: true });
      }

      return res.json({ success: true, data: { mistake: mistakeView(updatedMistake) } });
    } catch (error) {
      if (sendServiceError(res, error)) return undefined;
      const handled = withValidationErrors(res, error);
      if (handled) return handled;
      return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  return router;
};

module.exports = createFamilyMistakesRouter();
module.exports.createFamilyMistakesRouter = createFamilyMistakesRouter;
module.exports.mistakeView = mistakeView;
module.exports.toPublicMistake = mistakeView;
module.exports.resolveChildAccess = resolveChildAccess;

const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const KnowledgePoint = require('../models/KnowledgePoint');
const KnowledgePointMasteryEvent = require('../models/KnowledgePointMasteryEvent');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { parsePagination, sendFamilyError } = require('../../../common/utils/familyResponse');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const { requireParentChild, resolveChildAccess } = require('../services/growthAccess');
const { revisionOf, revisionMatch } = require('../services/knowledgePointState');

const router = express.Router();
const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const MASTERY_LEVELS = ['not_started', 'learning', 'basic', 'skilled', 'needs_review'];
const CREATE_FIELDS = ['childId', 'dimension', 'subject', 'area', 'name', 'masteryLevel'];
const UPDATE_FIELDS = ['masteryLevel', 'practiceCount', 'mistakeCount', 'lastReviewedAt'];
const sendError = (res, status, code, message) => sendFamilyError(res, status, code, message);
const hasUnknownField = (body, fields) => Object.keys(body).some((field) => !fields.includes(field));
const operationIdFor = (req) => {
  const idempotencyKey = req.get('Idempotency-Key');
  return typeof idempotencyKey === 'string' && idempotencyKey.trim()
    ? idempotencyKey.trim()
    : crypto.randomUUID();
};
const pointView = (point) => ({
  knowledgePointId: point._id.toString(),
  familyId: point.familyId.toString(),
  childId: point.childId.toString(),
  dimension: point.dimension,
  subject: point.subject,
  area: point.area,
  name: point.name,
  masteryLevel: point.masteryLevel,
  practiceCount: point.practiceCount,
  mistakeCount: point.mistakeCount,
  lastReviewedAt: point.lastReviewedAt,
  createdByParentId: point.createdByParentId.toString(),
  updatedByParentId: point.updatedByParentId.toString(),
  createdAt: point.createdAt,
  updatedAt: point.updatedAt
});

const masteryEventInput = (point, operationId, effectiveAt = new Date()) => ({
  familyId: point.familyId,
  childId: point.childId,
  knowledgePointId: point._id,
  dimension: point.dimension,
  subject: point.subject || '',
  area: point.area || '',
  name: point.name,
  masteryLevel: point.masteryLevel,
  effectiveAt,
  operationId
});

const createMasteryEvent = async (point, operationId, session) => {
  await KnowledgePointMasteryEvent.create([masteryEventInput(point, operationId)], { session });
};

router.post('/', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Only parents can create knowledge points');
    }
    if (hasUnknownField(req.body, CREATE_FIELDS)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields');
    }
    const { childId, dimension, name } = req.body;
    if (!childId || !dimension || !name) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'childId, dimension and name are required');
    }
    const access = await requireParentChild(req.user, childId);
    if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');
    const session = await mongoose.startSession();
    let point;
    try {
      await session.withTransaction(async () => {
        [point] = await KnowledgePoint.create([{
          familyId: access.familyId,
          childId,
          dimension,
          subject: req.body.subject || '',
          area: req.body.area || '',
          name,
          masteryLevel: req.body.masteryLevel,
          createdByParentId: req.user.id,
          updatedByParentId: req.user.id
        }], { session });
        await createMasteryEvent(point, operationIdFor(req), session);
      });
    } catch (error) {
      if (error.code === 11000) return sendError(res, 409, 'RESOURCE_CONFLICT', 'Knowledge point already exists');
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return sendError(res, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(res, 503, 'STATE_EVENT_UNAVAILABLE', 'Knowledge point mastery event store is unavailable');
    } finally {
      await session.endSession();
    }
    logFamilyOperation(req, {
      operation: 'knowledge_point.create', result: 'created', familyId: point.familyId.toString(),
      childId: point.childId.toString(), knowledgePointId: point._id.toString()
    });
    return res.status(201).json({ success: true, data: { knowledgePoint: pointView(point) } });
  } catch (error) {
    if (error.code === 11000) return sendError(res, 409, 'RESOURCE_CONFLICT', 'Knowledge point already exists');
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

router.get('/', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role === 'student' && req.query.childId
      && req.query.childId.toString() !== (req.user.childId || req.user.id).toString()) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot list another child points');
    }
    const childId = req.user.role === 'student' ? req.user.childId || req.user.id : req.query.childId;
    if (!childId) return sendError(res, 400, 'VALIDATION_ERROR', 'childId is required');
    const access = await resolveChildAccess(req.user, childId);
    if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');
    if (req.query.dimension && !DIMENSIONS.includes(req.query.dimension)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid dimension');
    }
    if (req.query.masteryLevel && !MASTERY_LEVELS.includes(req.query.masteryLevel)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid masteryLevel');
    }
    let pagination;
    try {
      pagination = parsePagination(req.query);
    } catch (error) {
      return sendError(res, 400, error.code, error.message);
    }
    const query = { familyId: access.familyId, childId };
    ['dimension', 'subject', 'area', 'masteryLevel'].forEach((field) => {
      if (req.query[field]) query[field] = req.query[field];
    });
    const [points, total] = await Promise.all([
      KnowledgePoint.find(query).sort({ dimension: 1, name: 1 })
        .skip(pagination.skip).limit(pagination.pageSize),
      KnowledgePoint.countDocuments(query)
    ]);
    return res.json({
      success: true,
      data: {
        items: points.map(pointView),
        page: pagination.page,
        pageSize: pagination.pageSize,
        total
      }
    });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

router.patch('/:knowledgePointId', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Only parents can update knowledge points');
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.knowledgePointId)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid knowledgePointId');
    }
    if (hasUnknownField(req.body, UPDATE_FIELDS)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields');
    }
    let point;
    const operationId = operationIdFor(req);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        point = await KnowledgePoint.findById(req.params.knowledgePointId).session(session);
        if (!point) throw Object.assign(new Error('Knowledge point not found'), { status: 404, code: 'RESOURCE_NOT_FOUND' });
        const access = await requireParentChild(req.user, point.childId.toString(), { session });
        if (!access || String(access.familyId) !== String(point.familyId)) {
          throw Object.assign(new Error('Cannot access this knowledge point'), { status: 403, code: 'CHILD_ACCESS_DENIED' });
        }
        const revision = revisionOf(point), previousMasteryLevel = point.masteryLevel;
        const update = { updatedByParentId: req.user.id };
        for (const field of UPDATE_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(req.body, field)) {
            point[field] = req.body[field]; update[field] = point[field];
          }
        }
        await point.validate();
        const shouldAppendMasteryEvent = Object.prototype.hasOwnProperty.call(req.body, 'masteryLevel')
          && point.masteryLevel !== previousMasteryLevel;
        point = await KnowledgePoint.findOneAndUpdate({ _id: point._id, familyId: point.familyId,
          childId: point.childId, ...revisionMatch(revision) }, { $set: update, $inc: { stateRevision: 1 } },
        { session, new: true, runValidators: true });
        if (!point) throw Object.assign(new Error('Knowledge point state changed'), { status: 409, code: 'RESOURCE_CONFLICT' });
        if (shouldAppendMasteryEvent) {
          await createMasteryEvent(point, operationId, session);
        }
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } catch (error) {
      if ([403, 404, 409].includes(error.status)) return sendError(res, error.status, error.code, error.message);
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return sendError(res, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(res, 503, 'STATE_EVENT_UNAVAILABLE', 'Knowledge point mastery event store is unavailable');
    } finally {
      await session.endSession();
    }
    logFamilyOperation(req, {
      operation: 'knowledge_point.update', result: 'updated', familyId: point.familyId.toString(),
      childId: point.childId.toString(), knowledgePointId: point._id.toString()
    });
    return res.json({ success: true, data: { knowledgePoint: pointView(point) } });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

module.exports = router;
module.exports.pointView = pointView;

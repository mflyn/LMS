const mongoose = require('mongoose');

const { sendFamilyError } = require('../../../common/utils/familyResponse');
const { createFamilyMembershipService } = require('../services/familyMembershipService');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const validationError = (message) => Object.assign(new Error(message), {
  status: 400,
  code: 'VALIDATION_ERROR',
  details: []
});
const requireFieldsOnly = (body, allowedFields, requiredFields = []) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw validationError('Request body must be an object');
  const unknown = Object.keys(body).filter((field) => !allowedFields.includes(field));
  if (unknown.length > 0) throw validationError(`Unknown fields: ${unknown.join(', ')}`);
  const missing = requiredFields.filter((field) => body[field] === undefined);
  if (missing.length > 0) throw validationError(`Missing fields: ${missing.join(', ')}`);
};
const requireParent = (req) => {
  if (!req.user || req.user.role !== 'parent') {
    throw Object.assign(new Error('Parent account is required'), {
      status: 403,
      code: 'FAMILY_GOVERNANCE_DENIED',
      details: []
    });
  }
};
const requireId = (value, name) => {
  if (!isObjectId(value)) throw validationError(`${name} is invalid`);
};
const respondError = (res, error) => sendFamilyError(
  res,
  error.status || 500,
  error.code || 'INTERNAL_ERROR',
  error.status ? error.message : 'Internal server error',
  error.details || []
);

const createParentMembershipController = ({ service = createFamilyMembershipService() } = {}) => {
  const handler = (work, { requireParentRole = true } = {}) => async (req, res) => {
    try {
      if (requireParentRole) requireParent(req);
      return await work(req, res);
    } catch (error) {
      if (error.code === 11000) {
        return sendFamilyError(
          res,
          409,
          'FAMILY_INVITATION_ALREADY_ACTIVE',
          'Family already has an active invitation'
        );
      }
      return respondError(res, error);
    }
  };

  return {
    createInvitation: handler(async (req, res) => {
      requireId(req.params.familyId, 'familyId');
      requireFieldsOnly(req.body || {}, []);
      const invitation = await service.createInvitation({
        actorParentId: req.user.id,
        familyId: req.params.familyId
      });
      return res.status(201).json({ success: true, data: { invitation } });
    }),
    getActiveInvitation: handler(async (req, res) => {
      requireId(req.params.familyId, 'familyId');
      const invitation = await service.getActiveInvitation({
        actorParentId: req.user.id,
        familyId: req.params.familyId
      });
      return res.json({ success: true, data: { invitation } });
    }),
    revokeInvitation: handler(async (req, res) => {
      requireId(req.params.familyId, 'familyId');
      requireId(req.params.invitationId, 'invitationId');
      await service.revokeInvitation({
        actorParentId: req.user.id,
        familyId: req.params.familyId,
        invitationId: req.params.invitationId
      });
      return res.status(204).send();
    }),
    previewInvitation: handler(async (req, res) => {
      requireFieldsOnly(req.body, ['token'], ['token']);
      const invitation = await service.previewInvitation({ token: req.body.token });
      requireParent(req);
      return res.json({ success: true, data: { invitation } });
    }, { requireParentRole: false }),
    acceptInvitation: handler(async (req, res) => {
      requireFieldsOnly(req.body, ['token', 'familyRole'], ['token', 'familyRole']);
      const family = await service.acceptInvitation({
        actorParentId: req.user.id,
        token: req.body.token,
        familyRole: req.body.familyRole
      });
      return res.json({ success: true, data: { family } });
    }, { requireParentRole: false }),
    leaveFamily: handler(async (req, res) => {
      requireId(req.params.familyId, 'familyId');
      await service.leaveFamily({ actorParentId: req.user.id, familyId: req.params.familyId });
      return res.status(204).send();
    }),
    removeMember: handler(async (req, res) => {
      requireId(req.params.familyId, 'familyId');
      requireId(req.params.parentId, 'parentId');
      await service.removeFamilyMember({
        actorParentId: req.user.id,
        familyId: req.params.familyId,
        targetParentId: req.params.parentId
      });
      return res.status(204).send();
    }),
    transferOwnership: handler(async (req, res) => {
      requireId(req.params.familyId, 'familyId');
      requireFieldsOnly(req.body, ['newOwnerParentId'], ['newOwnerParentId']);
      requireId(req.body.newOwnerParentId, 'newOwnerParentId');
      const family = await service.transferOwnership({
        actorParentId: req.user.id,
        familyId: req.params.familyId,
        newOwnerParentId: req.body.newOwnerParentId
      });
      return res.json({ success: true, data: { family } });
    })
  };
};

module.exports = {
  ...createParentMembershipController(),
  createParentMembershipController
};

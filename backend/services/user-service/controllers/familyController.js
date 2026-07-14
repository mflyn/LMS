const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { generateToken } = require('../../../common/middleware/auth');
const { isValidTimeZone } = require('../../../common/utils/familyDate');
const { parsePagination, sendFamilyError } = require('../../../common/utils/familyResponse');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const {
  FAMILY_CREATE_FIELDS,
  FAMILY_UPDATE_FIELDS
} = require('../../../common/contracts/familyGrowthApi');
const { applyEntries, buildChildProfilePatch } = require('../services/childProfilePatch');

const PIN_WINDOW_MS = 15 * 60 * 1000;
const PIN_MAX_FAILURES = 5;
const pinFailures = new Map();

const recordPinFailure = (failureKey, state, now) => {
  const withinWindow = state && state.windowStartedAt + PIN_WINDOW_MS > now;
  const failures = withinWindow ? state.failures + 1 : 1;
  const nextState = {
    failures,
    windowStartedAt: withinWindow ? state.windowStartedAt : now,
    lockedUntil: failures >= PIN_MAX_FAILURES ? now + PIN_WINDOW_MS : 0
  };
  pinFailures.set(failureKey, nextState);
  return nextState.lockedUntil > now;
};

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const familyView = (family) => ({
  familyId: family._id.toString(),
  familyName: family.familyName,
  timezone: family.timezone,
  ownerParentId: family.ownerParentId.toString(),
  memberParentIds: family.memberParentIds.map((id) => id.toString()),
  childIds: family.childIds.map((id) => id.toString()),
  createdAt: family.createdAt,
  updatedAt: family.updatedAt
});

const childView = (child, childAvatarMediaService = null) => {
  const profile = child.childProfile || {};
  const avatarMediaId = childAvatarMediaService
    ? childAvatarMediaService.publicAvatarMediaId(child)
    : (profile.avatarMediaId ? profile.avatarMediaId.toString() : null);
  return {
    childId: child._id.toString(),
    familyId: child.familyId ? child.familyId.toString() : undefined,
    name: child.name,
    grade: profile.grade || child.grade,
    school: profile.school,
    avatarMediaId,
    textbookVersion: profile.textbookVersion,
    interests: profile.interests || [],
    weakSubjects: profile.weakSubjects || [],
    sportsPreferences: profile.sportsPreferences || [],
    artInterests: profile.artInterests || [],
    laborHabits: profile.laborHabits || [],
    moralGoals: profile.moralGoals || []
  };
};

const statusCodes = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'CHILD_ACCESS_DENIED',
  404: 'RESOURCE_NOT_FOUND',
  409: 'RESOURCE_CONFLICT',
  429: 'PIN_LOGIN_RATE_LIMITED'
};

const sendError = (res, status, message, code = statusCodes[status] || 'INTERNAL_ERROR') => (
  sendFamilyError(res, status, code, message)
);

const familyValidationError = (message) => Object.assign(new Error(message), {
  status: 400,
  code: 'VALIDATION_ERROR'
});

const assertAllowedFields = (body, allowedFields) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw familyValidationError('Request body must be an object');
  }
  const unknown = Object.keys(body).filter((field) => !allowedFields.includes(field));
  if (unknown.length > 0) {
    throw familyValidationError(`Unknown family fields: ${unknown.join(', ')}`);
  }
};

const parseFamilyName = (value, { required = false } = {}) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') throw familyValidationError('familyName must be a string');
  const familyName = value.trim();
  if (!familyName) throw familyValidationError('familyName is required');
  if (familyName.length > 50) throw familyValidationError('familyName must not exceed 50 characters');
  return familyName;
};

const parseTimezone = (value) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !isValidTimeZone(value)) {
    throw familyValidationError('timezone must be a valid IANA timezone');
  }
  return value;
};

const requireParent = (req, res) => {
  if (!req.user || req.user.role !== 'parent') {
    sendError(res, 403, 'Only parents can access this resource');
    return false;
  }
  return true;
};

const findParentFamily = (parentId, session = null) => {
  const query = Family.findOne({
    $or: [
      { ownerParentId: parentId },
      { memberParentIds: parentId }
    ]
  });
  return session ? query.session(session) : query;
};

const assertFamilyChild = async (family, childId) => {
  if (!family || !isObjectId(childId)) {
    return null;
  }

  const child = await User.findById(childId).select('+childProfile.pinHash');
  if (!child || child.role !== 'student') {
    return null;
  }

  const sameFamily = child.familyId && child.familyId.toString() === family._id.toString();
  const listedChild = family.childIds.some((id) => id.toString() === child._id.toString());
  return sameFamily && listedChild ? child : null;
};

const getMyFamily = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const family = await findParentFamily(req.user.id);
    if (!family) {
      return sendError(res, 404, 'Family not found');
    }

    const children = await User.find({ _id: { $in: family.childIds }, role: 'student' });
    const childById = new Map(children.map((child) => [child._id.toString(), child]));
    const orderedChildren = family.childIds
      .map((id) => childById.get(id.toString()))
      .filter(Boolean)
      .map((child) => childView(child));

    return res.json({
      success: true,
      data: {
        family: familyView(family),
        children: orderedChildren,
        defaultChildId: orderedChildren[0] ? orderedChildren[0].childId : null
      }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const createFamily = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    assertAllowedFields(req.body, FAMILY_CREATE_FIELDS);
    const familyName = parseFamilyName(req.body.familyName, { required: true });
    const timezone = parseTimezone(req.body.timezone) || 'Asia/Shanghai';
    const familyRole = req.body.familyRole || 'guardian';
    if (!['father', 'mother', 'guardian', 'other'].includes(familyRole)) {
      throw familyValidationError('familyRole is invalid');
    }

    let family;
    await runMongoTransaction({
      mongooseInstance: mongoose,
      work: async (session) => {
        const existingFamily = await findParentFamily(req.user.id, session);
        if (existingFamily) {
          const error = new Error('Parent already belongs to a family');
          error.status = 409;
          throw error;
        }

        [family] = await Family.create([{
          familyName,
          timezone,
          ownerParentId: req.user.id,
          memberParentIds: [req.user.id],
          childIds: []
        }], { session });

        const parent = await User.findByIdAndUpdate(req.user.id, {
          familyId: family._id,
          'parentProfile.familyRole': familyRole
        }, { new: true, session });
        if (!parent || parent.role !== 'parent') {
          throw new Error('Parent not found');
        }
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        family: familyView(family)
      }
    });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      return sendError(res, 400, error.message, error.code);
    }
    if (error.status === 409) {
      return sendError(res, 409, error.message);
    }
    if (error.code === 11000) {
      return sendError(res, 409, 'Parent already belongs to a family');
    }
    return sendError(res, 500, error.message);
  }
};

const updateFamily = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    if (!isObjectId(req.params.familyId)) {
      return sendError(res, 400, 'Invalid familyId', 'VALIDATION_ERROR');
    }
    assertAllowedFields(req.body, FAMILY_UPDATE_FIELDS);
    if (Object.keys(req.body).length === 0) {
      throw familyValidationError('At least one family field is required');
    }
    const familyName = parseFamilyName(req.body.familyName);
    const timezone = parseTimezone(req.body.timezone);

    const family = await Family.findById(req.params.familyId);
    if (!family) {
      return sendError(res, 404, 'Family not found', 'RESOURCE_NOT_FOUND');
    }
    const parentId = req.user.id.toString();
    const ownsFamily = family.ownerParentId.toString() === parentId
      || family.memberParentIds.some((id) => id.toString() === parentId);
    if (!ownsFamily) {
      return sendError(res, 403, 'Cannot update another family');
    }

    if (familyName !== undefined) family.familyName = familyName;
    if (timezone !== undefined) family.timezone = timezone;
    await family.save();

    return res.json({
      success: true,
      data: { family: familyView(family) }
    });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR' || error.name === 'ValidationError') {
      return sendError(res, 400, error.message, 'VALIDATION_ERROR');
    }
    return sendError(res, 500, error.message);
  }
};

const createChild = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const family = await findParentFamily(req.user.id);
    if (!family) {
      return sendError(res, 404, 'Family not found');
    }

    const name = (req.body.name || '').trim();
    if (!name) {
      return sendError(res, 400, 'name is required');
    }

    const childSeed = new mongoose.Types.ObjectId().toString().slice(-8);
    let child;
    await runMongoTransaction({
      mongooseInstance: mongoose,
      work: async (session) => {
        const transactionalFamily = await findParentFamily(req.user.id, session);
        if (!transactionalFamily || transactionalFamily._id.toString() !== family._id.toString()) {
          throw new Error('Family relationship changed');
        }

        [child] = await User.create([{
          username: `c${childSeed}`,
          password: `child${childSeed}`,
          email: `c${childSeed}@child.local`,
          name,
          role: 'student',
          familyId: transactionalFamily._id,
          grade: req.body.grade,
          childProfile: {
            nickname: req.body.nickname || name,
            school: req.body.school,
            grade: req.body.grade,
            textbookVersion: req.body.textbookVersion,
            interests: req.body.interests || [],
            weakSubjects: req.body.weakSubjects || [],
            sportsPreferences: req.body.sportsPreferences || [],
            artInterests: req.body.artInterests || [],
            laborHabits: req.body.laborHabits || [],
            moralGoals: req.body.moralGoals || []
          }
        }], { session });

        transactionalFamily.childIds.addToSet(child._id);
        await transactionalFamily.save({ session });

        const parentUpdate = {
          $addToSet: { children: child._id },
          $set: {}
        };
        if (transactionalFamily.childIds.length === 1) {
          parentUpdate.$set['parentProfile.defaultChildId'] = child._id;
        }
        if (Object.keys(parentUpdate.$set).length === 0) {
          delete parentUpdate.$set;
        }
        const parent = await User.findByIdAndUpdate(req.user.id, parentUpdate, { new: true, session });
        if (!parent) throw new Error('Parent not found');
      }
    });

    return res.status(201).json({
      success: true,
      data: { child: childView(child) }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const listChildren = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const family = await findParentFamily(req.user.id);
    if (!family) {
      return sendError(res, 404, 'Family not found');
    }

    let pagination;
    try {
      pagination = parsePagination(req.query);
    } catch (error) {
      return sendError(res, 400, error.message, error.code);
    }
    const pagedIds = family.childIds.slice(pagination.skip, pagination.skip + pagination.pageSize);
    const children = await User.find({ _id: { $in: pagedIds }, role: 'student' });
    const childById = new Map(children.map((child) => [child._id.toString(), child]));
    const items = pagedIds
      .map((id) => childById.get(id.toString()))
      .filter(Boolean)
      .map((child) => childView(child));

    return res.json({
      success: true,
      data: {
        items,
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: family.childIds.length
      }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const createGetChild = (childAvatarMediaService) => async (req, res) => {
  try {
    const { childId } = req.params;
    if (!isObjectId(childId)) {
      return sendError(res, 400, 'Invalid childId');
    }

    if (req.user.role === 'student') {
      if (req.user.id !== childId) {
        return sendError(res, 403, 'Children can only access their own profile');
      }
      const child = await User.findById(childId);
      const resumed = child && childAvatarMediaService
        ? await childAvatarMediaService.resume(child)
        : child;
      return resumed
        ? res.json({ success: true, data: { child: childView(resumed, childAvatarMediaService) } })
        : sendError(res, 404, 'Child not found');
    }

    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents or the child can access this resource');
    }

    const family = await findParentFamily(req.user.id);
    const child = await assertFamilyChild(family, childId);
    if (!child) {
      return sendError(res, 403, 'Cannot access another family child');
    }

    const resumed = childAvatarMediaService ? await childAvatarMediaService.resume(child) : child;
    return res.json({ success: true, data: { child: childView(resumed, childAvatarMediaService) } });
  } catch (error) {
    if (error.status && error.code) {
      return sendFamilyError(res, error.status, error.code, error.message, error.details || []);
    }
    return sendError(res, 500, 'Internal server error');
  }
};

const createUpdateChild = (childAvatarMediaService) => async (req, res) => {
  let avatarAudit;
  try {
    if (!requireParent(req, res)) return;

    const family = await findParentFamily(req.user.id);
    const child = await assertFamilyChild(family, req.params.childId);
    if (!child) {
      return sendError(res, 403, 'Cannot update another family child');
    }

    const patch = buildChildProfilePatch(req.body);
    if (patch.hasAvatarMutation && !childAvatarMediaService) {
      return sendFamilyError(res, 400, 'MEDIA_NOT_ENABLED', 'Avatar media is not enabled');
    }
    if (patch.hasAvatarMutation) {
      avatarAudit = {
        operation: 'child.avatar.update',
        familyId: family._id.toString(),
        childId: child._id.toString(),
        mediaIds: patch.requestedAvatarMediaId ? [patch.requestedAvatarMediaId] : []
      };
    }

    let updatedChild;
    if (childAvatarMediaService && patch.hasAvatarMutation) {
      updatedChild = await childAvatarMediaService.mutate({
        child,
        familyId: family._id.toString(),
        requestedAvatarMediaId: patch.requestedAvatarMediaId,
        profilePatch: patch.entries
      });
      logFamilyOperation(req, {
        ...avatarAudit,
        result: 'success',
      });
    } else {
      applyEntries(child, patch.entries);
      await child.save();
      updatedChild = child;
    }

    return res.json({
      success: true,
      data: { child: childView(updatedChild, childAvatarMediaService) }
    });
  } catch (error) {
    if (avatarAudit) {
      logFamilyOperation(req, { ...avatarAudit, result: error.code || 'error' });
    }
    if (error.status && error.code) {
      return sendFamilyError(res, error.status, error.code, error.message, error.details || []);
    }
    return sendError(res, 500, 'Internal server error');
  }
};

const setChildPin = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const pin = String(req.body.pin || '');
    if (!/^\d{4,6}$/.test(pin)) {
      return sendError(res, 400, 'PIN must be 4 to 6 digits', 'VALIDATION_ERROR');
    }

    const family = await findParentFamily(req.user.id);
    const child = await assertFamilyChild(family, req.params.childId);
    if (!child) {
      return sendError(res, 403, 'Cannot update another family child');
    }

    child.childProfile.pinHash = await bcrypt.hash(pin, 10);
    child.childProfile.tokenVersion = (child.childProfile.tokenVersion || 0) + 1;
    await child.save();

    return res.json({
      success: true,
      data: { child: childView(child) }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const childPinLogin = async (req, res) => {
  try {
    const { familyId, childId, pin } = req.body;
    const failureKey = `${req.ip}|${familyId || ''}|${childId || ''}`;
    const now = Date.now();
    const state = pinFailures.get(failureKey);
    if (state && state.lockedUntil > now) {
      return sendError(res, 429, 'Too many child PIN attempts', 'PIN_LOGIN_RATE_LIMITED');
    }
    if (!isObjectId(familyId) || !isObjectId(childId) || !pin) {
      if (recordPinFailure(failureKey, state, now)) {
        return sendError(res, 429, 'Too many child PIN attempts', 'PIN_LOGIN_RATE_LIMITED');
      }
      return sendError(res, 401, 'Invalid child credentials', 'INVALID_CHILD_CREDENTIALS');
    }

    const family = await Family.findById(familyId);
    const child = await assertFamilyChild(family, childId);
    if (!child || !child.childProfile.pinHash) {
      if (recordPinFailure(failureKey, state, now)) {
        return sendError(res, 429, 'Too many child PIN attempts', 'PIN_LOGIN_RATE_LIMITED');
      }
      return sendError(res, 401, 'Invalid child credentials', 'INVALID_CHILD_CREDENTIALS');
    }

    const matches = await bcrypt.compare(String(pin), child.childProfile.pinHash);
    if (!matches) {
      if (recordPinFailure(failureKey, state, now)) {
        return sendError(res, 429, 'Too many child PIN attempts', 'PIN_LOGIN_RATE_LIMITED');
      }
      return sendError(res, 401, 'Invalid child credentials', 'INVALID_CHILD_CREDENTIALS');
    }

    pinFailures.delete(failureKey);

    const token = generateToken({
      id: child._id,
      username: child.username,
      role: 'student',
      childId: child._id.toString(),
      familyId: child.familyId.toString(),
      tokenVersion: child.childProfile.tokenVersion || 0
    }, 'access', { expiresIn: '12h' });

    return res.json({
      success: true,
      data: {
        token,
        child: childView(child)
      }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const createFamilyController = ({ childAvatarMediaService = null } = {}) => ({
  getMyFamily,
  createFamily,
  updateFamily,
  createChild,
  listChildren,
  getChild: createGetChild(childAvatarMediaService),
  updateChild: createUpdateChild(childAvatarMediaService),
  setChildPin,
  childPinLogin
});

module.exports = {
  ...createFamilyController(),
  createFamilyController
};

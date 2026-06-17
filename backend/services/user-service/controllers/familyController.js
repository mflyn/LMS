const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { generateToken } = require('../../../common/middleware/auth');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const familyView = (family) => ({
  familyId: family._id.toString(),
  familyName: family.familyName,
  ownerParentId: family.ownerParentId.toString(),
  memberParentIds: family.memberParentIds.map((id) => id.toString()),
  childIds: family.childIds.map((id) => id.toString()),
  createdAt: family.createdAt,
  updatedAt: family.updatedAt
});

const childView = (child) => {
  const profile = child.childProfile || {};
  return {
    childId: child._id.toString(),
    familyId: child.familyId ? child.familyId.toString() : undefined,
    name: child.name,
    grade: profile.grade || child.grade,
    school: profile.school,
    avatar: profile.avatar || child.avatar,
    textbookVersion: profile.textbookVersion,
    interests: profile.interests || [],
    weakSubjects: profile.weakSubjects || [],
    sportsPreferences: profile.sportsPreferences || [],
    artInterests: profile.artInterests || [],
    laborHabits: profile.laborHabits || [],
    moralGoals: profile.moralGoals || []
  };
};

const sendError = (res, status, message) => res.status(status).json({
  success: false,
  message
});

const requireParent = (req, res) => {
  if (!req.user || req.user.role !== 'parent') {
    sendError(res, 403, 'Only parents can access this resource');
    return false;
  }
  return true;
};

const findParentFamily = (parentId) => Family.findOne({
  $or: [
    { ownerParentId: parentId },
    { memberParentIds: parentId }
  ]
});

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
      .map(childView);

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

    const familyName = (req.body.familyName || '').trim();
    if (!familyName) {
      return sendError(res, 400, 'familyName is required');
    }

    const existingFamily = await findParentFamily(req.user.id);
    if (existingFamily) {
      return sendError(res, 409, 'Parent already belongs to a family');
    }

    const family = await Family.create({
      familyName,
      ownerParentId: req.user.id,
      memberParentIds: [req.user.id],
      childIds: []
    });

    await User.findByIdAndUpdate(req.user.id, {
      familyId: family._id,
      'parentProfile.familyRole': req.body.familyRole || 'guardian'
    });

    return res.status(201).json({
      success: true,
      data: {
        family: familyView(family)
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Parent already belongs to a family');
    }
    return sendError(res, 500, error.message);
  }
};

const updateFamily = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const family = await findParentFamily(req.user.id);
    if (!family || family._id.toString() !== req.params.familyId) {
      return sendError(res, 403, 'Cannot update another family');
    }

    if (req.body.familyName) {
      family.familyName = req.body.familyName.trim();
    }
    await family.save();

    return res.json({
      success: true,
      data: { family: familyView(family) }
    });
  } catch (error) {
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
    const child = await User.create({
      username: `c${childSeed}`,
      password: `child${childSeed}`,
      email: `c${childSeed}@child.local`,
      name,
      role: 'student',
      familyId: family._id,
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
    });

    family.childIds.push(child._id);
    await family.save();

    const parentUpdate = {
      $addToSet: { children: child._id },
      $set: {}
    };
    if (family.childIds.length === 1) {
      parentUpdate.$set['parentProfile.defaultChildId'] = child._id;
    }
    if (Object.keys(parentUpdate.$set).length === 0) {
      delete parentUpdate.$set;
    }
    await User.findByIdAndUpdate(req.user.id, parentUpdate);

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

    const children = await User.find({ _id: { $in: family.childIds }, role: 'student' });
    const childById = new Map(children.map((child) => [child._id.toString(), child]));
    const items = family.childIds
      .map((id) => childById.get(id.toString()))
      .filter(Boolean)
      .map(childView);

    return res.json({
      success: true,
      data: { items }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getChild = async (req, res) => {
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
      return child
        ? res.json({ success: true, data: { child: childView(child) } })
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

    return res.json({ success: true, data: { child: childView(child) } });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const updateChild = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const family = await findParentFamily(req.user.id);
    const child = await assertFamilyChild(family, req.params.childId);
    if (!child) {
      return sendError(res, 403, 'Cannot update another family child');
    }

    const allowedProfileFields = [
      'school',
      'grade',
      'textbookVersion',
      'interests',
      'weakSubjects',
      'sportsPreferences',
      'artInterests',
      'laborHabits',
      'moralGoals'
    ];

    if (req.body.name) {
      child.name = req.body.name.trim();
      child.childProfile.nickname = child.name;
    }
    if (req.body.grade) {
      child.grade = req.body.grade;
    }

    allowedProfileFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        child.childProfile[field] = req.body[field];
      }
    });

    await child.save();

    return res.json({
      success: true,
      data: { child: childView(child) }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const setChildPin = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const pin = String(req.body.pin || '');
    if (!/^\d{4,8}$/.test(pin)) {
      return sendError(res, 400, 'PIN must be 4 to 8 digits');
    }

    const family = await findParentFamily(req.user.id);
    const child = await assertFamilyChild(family, req.params.childId);
    if (!child) {
      return sendError(res, 403, 'Cannot update another family child');
    }

    child.childProfile.pinHash = await bcrypt.hash(pin, 10);
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
    if (!isObjectId(familyId) || !isObjectId(childId) || !pin) {
      return sendError(res, 400, 'familyId, childId and pin are required');
    }

    const family = await Family.findById(familyId);
    const child = await assertFamilyChild(family, childId);
    if (!child || !child.childProfile.pinHash) {
      return sendError(res, 401, 'Invalid child credentials');
    }

    const matches = await bcrypt.compare(String(pin), child.childProfile.pinHash);
    if (!matches) {
      return sendError(res, 401, 'Invalid child credentials');
    }

    const token = generateToken({
      id: child._id,
      username: child.username,
      role: 'student'
    });

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

module.exports = {
  getMyFamily,
  createFamily,
  updateFamily,
  createChild,
  listChildren,
  getChild,
  updateChild,
  setChildPin,
  childPinLogin
};

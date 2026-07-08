const mongoose = require('mongoose');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const resolveChildAccess = async (identity, childId) => {
  if (!identity || !isObjectId(childId)) return null;

  if (identity.role === 'student') {
    const identityChildId = identity.childId || identity.id;
    if (!isObjectId(identityChildId) || identityChildId.toString() !== childId.toString()) return null;
    if (identity.id && identity.id.toString() !== childId.toString()) return null;

    const child = await User.findOne({ _id: childId, role: 'student' });
    if (!child || !child.familyId) return null;
    if (identity.familyId && child.familyId.toString() !== identity.familyId.toString()) return null;
    return { familyId: child.familyId, child };
  }

  if (identity.role !== 'parent' || !isObjectId(identity.id)) return null;

  const family = await Family.findOne({
    $or: [{ ownerParentId: identity.id }, { memberParentIds: identity.id }],
    childIds: childId
  });
  if (!family) return null;

  const child = await User.findOne({ _id: childId, role: 'student', familyId: family._id });
  return child ? { familyId: family._id, family, child } : null;
};

const requireParentChild = async (identity, childId) => {
  if (!identity || identity.role !== 'parent') return null;
  return resolveChildAccess(identity, childId);
};

module.exports = { requireParentChild, resolveChildAccess };

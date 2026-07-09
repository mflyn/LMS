const mongoose = require('mongoose');

const Family = require('../models/Family');
const User = require('../models/User');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const findParentFamily = (FamilyModel, parentId, childId) => {
  const query = {
    $or: [{ ownerParentId: parentId }, { memberParentIds: parentId }]
  };
  if (childId !== undefined) query.childIds = childId;
  return FamilyModel.findOne(query);
};

const resolveChildAccess = async (
  identity,
  requestedChildId,
  { FamilyModel = Family, UserModel = User } = {}
) => {
  if (!identity) return null;

  if (identity.role === 'student') {
    const identityChildId = identity.childId || identity.id;
    if (!isObjectId(identityChildId)) return null;
    if (requestedChildId && requestedChildId.toString() !== identityChildId.toString()) return null;
    if (identity.id && identity.id.toString() !== identityChildId.toString()) return null;

    const child = await UserModel.findOne({ _id: identityChildId, role: 'student' });
    if (!child || !child.familyId) return null;
    if (identity.familyId && child.familyId.toString() !== identity.familyId.toString()) return null;

    const family = await FamilyModel.findOne({ _id: child.familyId, childIds: child._id });
    return family ? { familyId: family._id, family, child } : null;
  }

  if (identity.role !== 'parent' || !isObjectId(identity.id) || !isObjectId(requestedChildId)) {
    return null;
  }

  const family = await findParentFamily(FamilyModel, identity.id, requestedChildId);
  if (!family) return null;

  const child = await UserModel.findOne({
    _id: requestedChildId,
    role: 'student',
    familyId: family._id
  });
  return child ? { familyId: family._id, family, child } : null;
};

const resolveFamilyAccess = async (
  identity,
  requestedFamilyId,
  { FamilyModel = Family } = {}
) => {
  if (!identity || !['parent', 'student'].includes(identity.role)) return null;

  if (identity.role === 'student') {
    const familyId = identity.familyId;
    if (!familyId || !isObjectId(familyId)) return null;
    if (requestedFamilyId && requestedFamilyId.toString() !== familyId.toString()) return null;
    const family = await FamilyModel.findOne({ _id: familyId });
    return family ? { familyId: family._id.toString(), family } : null;
  }

  if (!isObjectId(identity.id)) return null;
  const family = await findParentFamily(FamilyModel, identity.id);
  if (!family) return null;
  if (requestedFamilyId && requestedFamilyId.toString() !== family._id.toString()) return null;
  return { familyId: family._id.toString(), family };
};

module.exports = {
  findParentFamily,
  isObjectId,
  resolveChildAccess,
  resolveFamilyAccess
};

const Task = require('../models/GrowthTask');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { ID, matches, error, invalid } = require('./growthTaskCompletionCommand');

const assertParentIdentity = identity => {
  if (!identity || identity.role !== 'parent' || !matches(identity.id, ID)) throw error(403, 'CHILD_ACCESS_DENIED');
};
const authorizeParentChild = async (identity, childId, session) => {
  assertParentIdentity(identity);
  if (!matches(childId, ID)) throw error(403, 'CHILD_ACCESS_DENIED');
  const access = await resolveChildAccess(identity, childId, {
    FamilyModel: { findOne: query => Family.findOne(query).session(session) },
    UserModel: { findOne: query => User.findOne(query).session(session) }
  });
  const parent = await User.findOne({ _id: identity.id, role: 'parent' }).session(session).lean();
  if (!parent || !access) throw error(403, 'CHILD_ACCESS_DENIED');
  return access;
};
const authorizeParentTask = async (identity, taskId, session) => {
  assertParentIdentity(identity);
  if (!matches(taskId, ID)) throw invalid();
  const task = await Task.findById(taskId).select('+activeCompletionOperation +completionPending').session(session).lean();
  if (!task) throw error(403, 'CHILD_ACCESS_DENIED');
  const access = await authorizeParentChild(identity, String(task.childId), session);
  if (String(access.familyId) !== String(task.familyId)) throw error(403, 'CHILD_ACCESS_DENIED');
  return task;
};

module.exports = { assertParentIdentity, authorizeParentChild, authorizeParentTask };

const mongoose = require('mongoose');

const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const {
  assertTransactionCapability,
  runMongoTransaction
} = require('../../../common/services/mongoTransaction');

const idString = (value) => (value ? value.toString() : null);
const uniqueIds = (values) => [...new Set(values.filter(Boolean).map(idString))];
const sameIds = (left, right) => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const buildAuthorityMap = (families, users) => {
  const declarations = new Map();
  const owners = new Map();
  families.forEach((family) => {
    const familyId = idString(family._id);
    owners.set(idString(family.ownerParentId), familyId);
    uniqueIds([...(family.memberParentIds || []), ...(family.childIds || [])]).forEach((userId) => {
      const familyIds = declarations.get(userId) || new Set();
      familyIds.add(familyId);
      declarations.set(userId, familyIds);
    });
  });

  const authority = new Map();
  users.forEach((user) => {
    const userId = idString(user._id);
    const storedFamilyId = idString(user.familyId);
    if (storedFamilyId) {
      authority.set(userId, storedFamilyId);
      return;
    }
    if (owners.has(userId)) {
      authority.set(userId, owners.get(userId));
      return;
    }
    const familyIds = [...(declarations.get(userId) || [])];
    authority.set(userId, familyIds.length === 1 ? familyIds[0] : null);
  });
  return { authority, declarations };
};

const planFamilyRelationshipRepairs = ({ families, users }) => {
  const userById = new Map(users.map((user) => [idString(user._id), user]));
  const { authority, declarations } = buildAuthorityMap(families, users);
  const operations = [];
  const conflicts = [];

  const acceptDeclaredUser = ({ familyId, userId, role }) => {
    const user = userById.get(userId);
    if (!user) {
      conflicts.push({ code: 'USER_NOT_FOUND', familyId, userId, expectedRole: role });
      return false;
    }
    if (user.role !== role) {
      conflicts.push({ code: 'USER_ROLE_CONFLICT', familyId, userId, expectedRole: role, actualRole: user.role });
      return false;
    }
    const authoritativeFamilyId = authority.get(userId);
    if (!authoritativeFamilyId) {
      conflicts.push({
        code: 'AMBIGUOUS_FAMILY_DECLARATION',
        familyId,
        userId,
        declaredFamilyIds: [...(declarations.get(userId) || [])]
      });
      return false;
    }
    if (authoritativeFamilyId !== familyId) {
      conflicts.push({ code: 'USER_FAMILY_CONFLICT', familyId, userId, authoritativeFamilyId });
      return false;
    }
    return true;
  };

  families.forEach((family) => {
    const familyId = idString(family._id);
    const memberCandidates = uniqueIds([family.ownerParentId, ...(family.memberParentIds || [])]);
    const childCandidates = uniqueIds(family.childIds || []);

    users.forEach((user) => {
      if (idString(user.familyId) !== familyId) return;
      if (user.role === 'parent') memberCandidates.push(idString(user._id));
      if (user.role === 'student') childCandidates.push(idString(user._id));
    });

    const memberParentIds = uniqueIds(memberCandidates)
      .filter((userId) => acceptDeclaredUser({ familyId, userId, role: 'parent' }));
    const childIds = uniqueIds(childCandidates)
      .filter((userId) => acceptDeclaredUser({ familyId, userId, role: 'student' }));
    const currentMemberIds = uniqueIds(family.memberParentIds || []);
    const currentChildIds = uniqueIds(family.childIds || []);

    if (!sameIds(currentMemberIds, memberParentIds) || !sameIds(currentChildIds, childIds)) {
      operations.push({
        entity: 'Family',
        id: familyId,
        set: { memberParentIds, childIds },
        before: { memberParentIds: currentMemberIds, childIds: currentChildIds }
      });
    }

    memberParentIds.forEach((userId) => {
      const user = userById.get(userId);
      const currentChildren = uniqueIds(user.children || []);
      const currentDefault = idString(user.parentProfile && user.parentProfile.defaultChildId);
      const defaultChildId = currentDefault && childIds.includes(currentDefault)
        ? currentDefault
        : (childIds[0] || null);
      const set = {};
      if (idString(user.familyId) !== familyId) set.familyId = familyId;
      if (!sameIds(currentChildren, childIds)) set.children = childIds;
      if (currentDefault !== defaultChildId) set['parentProfile.defaultChildId'] = defaultChildId;
      if (Object.keys(set).length > 0) {
        operations.push({
          entity: 'User',
          id: userId,
          set,
          before: {
            familyId: idString(user.familyId),
            children: currentChildren,
            defaultChildId: currentDefault
          }
        });
      }
    });

    childIds.forEach((userId) => {
      const user = userById.get(userId);
      if (idString(user.familyId) !== familyId) {
        operations.push({
          entity: 'User',
          id: userId,
          set: { familyId },
          before: { familyId: idString(user.familyId) }
        });
      }
    });
  });

  return { operations, conflicts };
};

const repairFamilyRelationships = async ({
  FamilyModel = Family,
  UserModel = User,
  dryRun = true,
  emit = (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`),
  mongooseInstance = mongoose
} = {}) => {
  const [families, users] = await Promise.all([
    FamilyModel.find({}).lean(),
    UserModel.find({ role: { $in: ['parent', 'student'] } })
      .select('+parentProfile.defaultChildId')
      .lean()
  ]);
  const { operations, conflicts } = planFamilyRelationshipRepairs({ families, users });
  const mode = dryRun ? 'dry-run' : 'apply';

  operations.forEach((operation) => emit({ event: 'family_relationship_repair', mode, operation }));

  if (!dryRun && operations.length > 0) {
    await runMongoTransaction({
      mongooseInstance,
      work: async (session) => {
        for (const operation of operations) {
          const Model = operation.entity === 'Family' ? FamilyModel : UserModel;
          const result = await Model.updateOne(
            { _id: operation.id },
            { $set: operation.set },
            { session, runValidators: true }
          );
          if (result.matchedCount !== 1) {
            throw new Error(`${operation.entity} ${operation.id} disappeared during repair`);
          }
        }
      }
    });
  }

  return {
    mode,
    scanned: { families: families.length, users: users.length },
    operations,
    conflicts,
    applied: dryRun ? 0 : operations.length
  };
};

const runCli = async () => {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((arg) => arg !== '--apply');
  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown.join(', ')}`);
  const mongoURI = process.env.MONGO_URI || process.env.USER_SERVICE_MONGO_URI;
  if (!mongoURI) throw new Error('MONGO_URI or USER_SERVICE_MONGO_URI is required');

  await mongoose.connect(mongoURI);
  try {
    await assertTransactionCapability(mongoose.connection, 'family relationship repair');
    const result = await repairFamilyRelationships({ dryRun: !args.has('--apply') });
    process.stdout.write(`${JSON.stringify({ event: 'family_relationship_repair_summary', ...result })}\n`);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  runCli().catch((error) => {
    process.stderr.write(`${JSON.stringify({ event: 'family_relationship_repair_failed', message: error.message })}\n`);
    process.exitCode = 1;
  });
}

module.exports = { planFamilyRelationshipRepairs, repairFamilyRelationships, runCli };

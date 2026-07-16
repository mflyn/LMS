const User = require('../../../../common/models/User');
const Family = require('../../../../common/models/Family');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

const createUser = (role, name) => {
  const key = unique(role === 'parent' ? 'p' : 'c');
  return User.create({
    username: key,
    password: 'password123',
    email: `${key}@example.com`,
    name,
    role
  });
};

const createTask5Fixtures = async () => {
  const parentA = await createUser('parent', 'Parent A');
  const parentB = await createUser('parent', 'Parent B');
  const familyA = await Family.create({
    familyName: 'Family A',
    ownerParentId: parentA._id,
    memberParentIds: [parentA._id]
  });
  const familyB = await Family.create({
    familyName: 'Family B',
    ownerParentId: parentB._id,
    memberParentIds: [parentB._id]
  });
  const childA1 = await createUser('student', 'Child A1');
  const childA2 = await createUser('student', 'Child A2');
  const childB1 = await createUser('student', 'Child B1');

  childA1.familyId = familyA._id;
  childA2.familyId = familyA._id;
  childB1.familyId = familyB._id;
  await Promise.all([childA1.save(), childA2.save(), childB1.save()]);
  familyA.childIds = [childA1._id, childA2._id];
  familyB.childIds = [childB1._id];
  await Promise.all([familyA.save(), familyB.save()]);

  const identityFor = (user) => user.role === 'student'
    ? {
      id: user._id.toString(),
      childId: user._id.toString(),
      familyId: user.familyId.toString(),
      role: 'student',
      tokenVersion: user.childProfile.tokenVersion
    }
    : { id: user._id.toString(), role: 'parent' };

  const headers = (user, method, originalUrl) => createIdentityHeaders({
    method,
    originalUrl,
    user: identityFor(user),
    secret: process.env.GATEWAY_IDENTITY_SECRET
  });

  return { parentA, parentB, familyA, familyB, childA1, childA2, childB1, headers };
};

module.exports = { createTask5Fixtures };

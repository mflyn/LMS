const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const {
  repairFamilyRelationships
} = require('../../scripts/repairFamilyRelationships');

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

const createParent = (overrides = {}) => User.create({
  username: unique('p'),
  password: 'parent123',
  email: `${unique('p')}@example.com`,
  name: 'Repair Parent',
  role: 'parent',
  ...overrides
});

const createChild = (familyId, overrides = {}) => User.create({
  username: unique('c'),
  password: 'child123',
  email: `${unique('c')}@child.local`,
  name: 'Repair Child',
  role: 'student',
  familyId,
  ...overrides
});

describe('family relationship repair command', () => {
  const insertHistoricalFamily = async (values) => {
    const _id = values._id || new Family()._id;
    await Family.collection.insertOne({
      _id,
      timezone: 'Asia/Shanghai',
      childIds: [],
      ...values
    });
    return Family.findById(_id);
  };

  test('dry-run emits auditable changes without writing data', async () => {
    const parent = await createParent();
    const family = await insertHistoricalFamily({
      familyName: 'Repair Family',
      ownerParentId: parent._id,
      memberParentIds: [],
      childIds: []
    });
    const child = await createChild(family._id);
    const audit = [];

    const result = await repairFamilyRelationships({
      dryRun: true,
      emit: (entry) => audit.push(entry)
    });

    expect(result).toEqual(expect.objectContaining({
      mode: 'dry-run',
      applied: 0,
      conflicts: []
    }));
    expect(result.operations.length).toBeGreaterThanOrEqual(2);
    expect(audit).toHaveLength(result.operations.length);
    expect(audit[0]).toEqual(expect.objectContaining({
      event: 'family_relationship_repair',
      mode: 'dry-run'
    }));
    expect((await Family.findById(family._id)).childIds).toHaveLength(0);
    expect((await User.findById(parent._id)).familyId).toBeUndefined();
    expect((await User.findById(parent._id)).children).toHaveLength(0);
    expect((await User.findById(child._id)).familyId.toString()).toBe(family._id.toString());
  });

  test('apply repairs Family, parent, and child links in one transaction', async () => {
    const parent = await createParent();
    const family = await insertHistoricalFamily({
      familyName: 'Apply Family',
      ownerParentId: parent._id,
      memberParentIds: [],
      childIds: []
    });
    const child = await createChild(family._id);

    const result = await repairFamilyRelationships({ dryRun: false, emit: jest.fn() });

    expect(result.mode).toBe('apply');
    expect(result.applied).toBe(result.operations.length);
    const repairedFamily = await Family.findById(family._id);
    const repairedParent = await User.findById(parent._id);
    expect(repairedFamily.memberParentIds.map(String)).toEqual([parent._id.toString()]);
    expect(repairedFamily.childIds.map(String)).toEqual([child._id.toString()]);
    expect(repairedParent.familyId.toString()).toBe(family._id.toString());
    expect(repairedParent.children.map(String)).toEqual([child._id.toString()]);
    expect(repairedParent.parentProfile.defaultChildId.toString()).toBe(child._id.toString());
  });

  test('reports cross-family declarations and never reassigns the user', async () => {
    const parentA = await createParent();
    const parentB = await createParent();
    const familyA = await Family.create({
      familyName: 'Family A',
      ownerParentId: parentA._id,
      memberParentIds: [parentA._id],
      childIds: []
    });
    const familyB = await Family.create({
      familyName: 'Family B',
      ownerParentId: parentB._id,
      memberParentIds: [parentB._id],
      childIds: []
    });
    const childB = await createChild(familyB._id);
    await Family.findByIdAndUpdate(familyA._id, { $addToSet: { childIds: childB._id } });

    const result = await repairFamilyRelationships({ dryRun: false, emit: jest.fn() });

    expect(result.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'USER_FAMILY_CONFLICT',
        familyId: familyA._id.toString(),
        userId: childB._id.toString()
      })
    ]));
    expect((await User.findById(childB._id)).familyId.toString()).toBe(familyB._id.toString());
    expect((await Family.findById(familyA._id)).childIds.map(String)).not.toContain(childB._id.toString());
    expect((await Family.findById(familyB._id)).childIds.map(String)).toContain(childB._id.toString());
  });
});

const mongoose = require('mongoose');

const ids = () => ({
  familyId: new mongoose.Types.ObjectId(),
  childId: new mongoose.Types.ObjectId(),
  actorId: new mongoose.Types.ObjectId()
});

describe('Task 5 growth logs', () => {
  test('TC-T5-LOG-005 resolves only parent-owned and child-self access', async () => {
    const User = require('../../../common/models/User');
    const Family = require('../../../common/models/Family');
    const { resolveChildAccess } = require('../services/growthAccess');
    const suffix = Math.random().toString(36).slice(2, 10);
    const parentA = await User.create({
      username: `pa${suffix}`, password: 'parent123', email: `pa${suffix}@example.com`, name: 'Parent A', role: 'parent'
    });
    const parentB = await User.create({
      username: `pb${suffix}`, password: 'parent123', email: `pb${suffix}@example.com`, name: 'Parent B', role: 'parent'
    });
    const familyA = await Family.create({ familyName: 'Family A', ownerParentId: parentA._id });
    const familyB = await Family.create({ familyName: 'Family B', ownerParentId: parentB._id });
    const childA1 = await User.create({
      username: `c1${suffix}`, password: 'child123', email: `c1${suffix}@example.com`, name: 'Child A1', role: 'student', familyId: familyA._id
    });
    const childA2 = await User.create({
      username: `c2${suffix}`, password: 'child123', email: `c2${suffix}@example.com`, name: 'Child A2', role: 'student', familyId: familyA._id
    });
    familyA.childIds = [childA1._id, childA2._id];
    await familyA.save();

    await expect(resolveChildAccess({ id: parentA._id.toString(), role: 'parent' }, childA1._id.toString()))
      .resolves.toMatchObject({ familyId: familyA._id });
    await expect(resolveChildAccess({ id: parentB._id.toString(), role: 'parent' }, childA1._id.toString()))
      .resolves.toBeNull();
    await expect(resolveChildAccess({
      id: childA1._id.toString(), childId: childA1._id.toString(), role: 'student', familyId: familyA._id.toString()
    }, childA2._id.toString())).resolves.toBeNull();
    expect(familyB.childIds).toHaveLength(0);
  });

  test('TC-T5-LOG-001 accepts all five dimensions with LocalDate ownership', async () => {
    const GrowthLog = require('../models/GrowthLog');
    const dimensions = ['moral', 'academic', 'physical', 'artistic', 'labor'];

    for (const dimension of dimensions) {
      const owner = ids();
      const log = await GrowthLog.create({
        ...owner,
        createdBy: owner.actorId,
        updatedBy: owner.actorId,
        date: '2026-06-19',
        dimension,
        content: `${dimension} activity`
      });
      expect(log.dimension).toBe(dimension);
      expect(log.date).toBe('2026-06-19');
    }
  });

  test('TC-T5-LOG-002 rejects invalid dates, values, enums and content', async () => {
    const GrowthLog = require('../models/GrowthLog');
    const owner = ids();
    const base = {
      ...owner,
      createdBy: owner.actorId,
      updatedBy: owner.actorId,
      date: '2026-02-30',
      dimension: 'unknown',
      content: 'x'.repeat(1001),
      durationMinutes: -1,
      amount: -1
    };

    await expect(new GrowthLog(base).validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });
});

const mongoose = require('mongoose');

const parentId = new mongoose.Types.ObjectId();
const familyId = new mongoose.Types.ObjectId();
const childId = new mongoose.Types.ObjectId();

const buildModels = ({ family, child } = {}) => ({
  FamilyModel: {
    findOne: jest.fn().mockResolvedValue(family || null)
  },
  UserModel: {
    findOne: jest.fn().mockResolvedValue(child || null)
  }
});

describe('family access helpers', () => {
  test('resolves parent access to an owned child with family and child documents', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const family = { _id: familyId, childIds: [childId] };
    const child = { _id: childId, familyId, role: 'student' };
    const models = buildModels({ family, child });

    const access = await resolveChildAccess(
      { id: parentId.toString(), role: 'parent' },
      childId.toString(),
      models
    );

    expect(access).toEqual({ familyId, family, child });
    expect(models.FamilyModel.findOne).toHaveBeenCalledWith({
      $or: [{ ownerParentId: parentId.toString() }, { memberParentIds: parentId.toString() }],
      childIds: childId.toString()
    });
    expect(models.UserModel.findOne).toHaveBeenCalledWith({
      _id: childId.toString(),
      role: 'student',
      familyId
    });
  });

  test('rejects a student identity that requests another child', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const siblingId = new mongoose.Types.ObjectId().toString();
    const models = buildModels();

    await expect(resolveChildAccess(
      { id: childId.toString(), childId: childId.toString(), role: 'student' },
      siblingId,
      models
    )).resolves.toBeNull();
    expect(models.FamilyModel.findOne).not.toHaveBeenCalled();
    expect(models.UserModel.findOne).not.toHaveBeenCalled();
  });

  test('resolves parent family access from ownership and requested family id', async () => {
    const { resolveFamilyAccess } = require('../familyAccess');
    const family = { _id: familyId };
    const models = buildModels({ family });

    const access = await resolveFamilyAccess(
      { id: parentId.toString(), role: 'parent' },
      familyId.toString(),
      models
    );

    expect(access).toEqual({ familyId: familyId.toString(), family });
  });
});

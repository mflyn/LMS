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
  test('returns null when no identity is provided for child access', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const models = buildModels();

    await expect(resolveChildAccess(null, childId.toString(), models)).resolves.toBeNull();
    expect(models.FamilyModel.findOne).not.toHaveBeenCalled();
    expect(models.UserModel.findOne).not.toHaveBeenCalled();
  });

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

  test('rejects parent child access when identity or child id is invalid', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const models = buildModels();

    await expect(resolveChildAccess(
      { id: 'not-an-object-id', role: 'parent' },
      childId.toString(),
      models
    )).resolves.toBeNull();
    await expect(resolveChildAccess(
      { id: parentId.toString(), role: 'parent' },
      'not-an-object-id',
      models
    )).resolves.toBeNull();
    expect(models.FamilyModel.findOne).not.toHaveBeenCalled();
    expect(models.UserModel.findOne).not.toHaveBeenCalled();
  });

  test('rejects parent child access when family or child lookup fails', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const familyOnlyModels = buildModels({ family: { _id: familyId } });

    await expect(resolveChildAccess(
      { id: parentId.toString(), role: 'parent' },
      childId.toString(),
      buildModels()
    )).resolves.toBeNull();
    await expect(resolveChildAccess(
      { id: parentId.toString(), role: 'parent' },
      childId.toString(),
      familyOnlyModels
    )).resolves.toBeNull();
  });

  test('resolves student access to their own child document and family', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const family = { _id: familyId, childIds: [childId] };
    const child = { _id: childId, familyId, role: 'student' };
    const models = buildModels({ family, child });

    const access = await resolveChildAccess(
      { id: childId.toString(), childId: childId.toString(), familyId: familyId.toString(), role: 'student' },
      childId.toString(),
      models
    );

    expect(access).toEqual({ familyId, family, child });
    expect(models.UserModel.findOne).toHaveBeenCalledWith({
      _id: childId.toString(),
      role: 'student'
    });
    expect(models.FamilyModel.findOne).toHaveBeenCalledWith({
      _id: familyId,
      childIds: childId
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

  test('rejects student child access when identity is stale or inconsistent', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const child = { _id: childId, familyId, role: 'student' };
    const models = buildModels({ child });

    await expect(resolveChildAccess(
      { id: childId.toString(), childId: 'not-an-object-id', role: 'student' },
      undefined,
      models
    )).resolves.toBeNull();
    await expect(resolveChildAccess(
      { id: parentId.toString(), childId: childId.toString(), role: 'student' },
      childId.toString(),
      models
    )).resolves.toBeNull();
    await expect(resolveChildAccess(
      { id: childId.toString(), childId: childId.toString(), familyId: parentId.toString(), role: 'student' },
      childId.toString(),
      models
    )).resolves.toBeNull();
  });

  test('rejects student child access when child has no family or family lookup misses', async () => {
    const { resolveChildAccess } = require('../familyAccess');
    const noFamilyChild = { _id: childId, role: 'student' };

    await expect(resolveChildAccess(
      { id: childId.toString(), childId: childId.toString(), role: 'student' },
      childId.toString(),
      buildModels({ child: noFamilyChild })
    )).resolves.toBeNull();
    await expect(resolveChildAccess(
      { id: childId.toString(), childId: childId.toString(), role: 'student' },
      childId.toString(),
      buildModels({ child: { _id: childId, familyId, role: 'student' } })
    )).resolves.toBeNull();
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

  test('resolves student family access when requested family matches', async () => {
    const { resolveFamilyAccess } = require('../familyAccess');
    const family = { _id: familyId };
    const models = buildModels({ family });

    const access = await resolveFamilyAccess(
      { id: childId.toString(), familyId: familyId.toString(), role: 'student' },
      familyId.toString(),
      models
    );

    expect(access).toEqual({ familyId: familyId.toString(), family });
    expect(models.FamilyModel.findOne).toHaveBeenCalledWith({ _id: familyId.toString() });
  });

  test('rejects unsupported family access identities before querying', async () => {
    const { resolveFamilyAccess } = require('../familyAccess');
    const models = buildModels();

    await expect(resolveFamilyAccess(null, familyId.toString(), models)).resolves.toBeNull();
    await expect(resolveFamilyAccess({ id: parentId.toString(), role: 'teacher' }, familyId.toString(), models)).resolves.toBeNull();
    await expect(resolveFamilyAccess({ id: 'not-an-object-id', role: 'parent' }, familyId.toString(), models)).resolves.toBeNull();
    await expect(resolveFamilyAccess({ id: childId.toString(), role: 'student' }, familyId.toString(), models)).resolves.toBeNull();
    await expect(resolveFamilyAccess({ id: childId.toString(), familyId: 'not-an-object-id', role: 'student' }, familyId.toString(), models)).resolves.toBeNull();
    expect(models.FamilyModel.findOne).not.toHaveBeenCalled();
  });

  test('rejects family access when requested family mismatches or lookup misses', async () => {
    const { resolveFamilyAccess } = require('../familyAccess');
    const otherFamilyId = new mongoose.Types.ObjectId().toString();

    await expect(resolveFamilyAccess(
      { id: childId.toString(), familyId: familyId.toString(), role: 'student' },
      otherFamilyId,
      buildModels({ family: { _id: familyId } })
    )).resolves.toBeNull();
    await expect(resolveFamilyAccess(
      { id: childId.toString(), familyId: familyId.toString(), role: 'student' },
      familyId.toString(),
      buildModels()
    )).resolves.toBeNull();
    await expect(resolveFamilyAccess(
      { id: parentId.toString(), role: 'parent' },
      otherFamilyId,
      buildModels({ family: { _id: familyId } })
    )).resolves.toBeNull();
    await expect(resolveFamilyAccess(
      { id: parentId.toString(), role: 'parent' },
      familyId.toString(),
      buildModels()
    )).resolves.toBeNull();
  });
});

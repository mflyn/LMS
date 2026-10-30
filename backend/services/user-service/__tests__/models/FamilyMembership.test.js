const mongoose = require('mongoose');

const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const FamilyParentInvitation = require('../../../../common/models/FamilyParentInvitation');
const FamilyMembershipEvent = require('../../../../common/models/FamilyMembershipEvent');

const createParent = (suffix) => User.create({
  username: `m_${suffix}`,
  password: 'parent123',
  email: `membership_${suffix}@example.com`,
  name: `Parent ${suffix}`,
  role: 'parent'
});

const freshInvitationModel = () => {
  const schema = FamilyParentInvitation.schema.clone();
  schema.set('autoCreate', false);
  schema.set('autoIndex', false);
  const name = `InvitationIndexProbe_${new mongoose.Types.ObjectId()}`;
  return mongoose.model(name, schema, name.toLowerCase());
};

const invitationRow = (familyId, status = 'pending') => ({
  familyId,
  invitedByParentId: new mongoose.Types.ObjectId(),
  tokenDigest: new mongoose.Types.ObjectId().toString().padStart(64, '0'),
  status,
  expiresAt: new Date('2099-01-01T00:00:00.000Z')
});

describe('MongoDB 4.4 compatible invitation index contract', () => {
  test('keeps only the conditional unique single-field index and the query compound index', () => {
    const indexes = FamilyParentInvitation.schema.indexes();
    const familyOnly = indexes.filter(([keys]) => JSON.stringify(keys) === JSON.stringify({ familyId: 1 }));
    expect(familyOnly).toHaveLength(1);
    expect(familyOnly[0][1]).toMatchObject({ unique: true,
      partialFilterExpression: { status: 'pending' }, name: 'one_pending_parent_invitation_per_family' });
    expect(indexes.some(([keys]) => JSON.stringify(keys)
      === JSON.stringify({ familyId: 1, status: 1, expiresAt: 1 }))).toBe(true);
  });

  test('initializes an empty collection and replays index creation without replacing constraints', async () => {
    const Model = freshInvitationModel();
    await Model.createCollection();
    expect(await Model.countDocuments({})).toBe(0);
    await Model.createIndexes();
    const before = await Model.collection.indexes();
    expect(before.map(index => index.name).sort()).toEqual([
      '_id_', 'familyId_1_status_1_expiresAt_1', 'one_pending_parent_invitation_per_family', 'tokenDigest_1'
    ]);
    await Model.createIndexes();
    expect(await Model.collection.indexes()).toEqual(before);
  });

  test('rejects concurrent pending invitations and pending reopening without rejecting historical states', async () => {
    const Model = freshInvitationModel(), familyId = new mongoose.Types.ObjectId();
    await Model.createCollection(); await Model.createIndexes();
    const results = await Promise.allSettled([
      Model.create(invitationRow(familyId)), Model.create(invitationRow(familyId))
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter(result => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 11000, keyPattern: { familyId: 1 } });
    expect(await Model.countDocuments({ familyId, status: 'pending' })).toBe(1);
    const histories = await Model.create(['accepted', 'revoked', 'expired'].flatMap(status => [
      invitationRow(familyId, status), invitationRow(familyId, status)
    ]));
    expect(histories).toHaveLength(6);
    await expect(Model.updateOne({ _id: histories[0]._id }, { $set: { status: 'pending' } }))
      .rejects.toMatchObject({ code: 11000, keyPattern: { familyId: 1 } });
    expect((await Model.findById(histories[0]._id)).status).toBe('accepted');
    await Model.create(invitationRow(new mongoose.Types.ObjectId()));
    await Model.updateOne({ familyId, status: 'pending' }, { $set: { status: 'accepted' } });
    await Model.create(invitationRow(familyId));
    expect(await Model.countDocuments({ familyId, status: 'pending' })).toBe(1);
  });

  test('retains global token digest uniqueness across families and historical states', async () => {
    const Model = freshInvitationModel(), row = invitationRow(new mongoose.Types.ObjectId(), 'expired');
    await Model.createCollection(); await Model.createIndexes();
    await Model.create(row);
    await expect(Model.create({ ...row, familyId: new mongoose.Types.ObjectId(), status: 'accepted' }))
      .rejects.toMatchObject({ code: 11000, keyPattern: { tokenDigest: 1 } });
  });
});

describe('Task 12 family membership models', () => {
  test('TC-T12-MODEL-001 rejects missing owner, duplicate members, and more than two members', async () => {
    const [owner, member, third] = await Promise.all([
      createParent('owner'),
      createParent('member'),
      createParent('third')
    ]);

    for (const memberParentIds of [
      [member._id],
      [owner._id, owner._id],
      [owner._id, member._id, third._id]
    ]) {
      await expect(Family.create({
        familyName: 'Invalid membership',
        ownerParentId: owner._id,
        memberParentIds
      })).rejects.toThrow(/memberParentIds/);
    }
  });

  test('TC-T12-MODEL-002 stores valid owner-only and two-parent families', async () => {
    const [owner, member] = await Promise.all([
      createParent('vowner'),
      createParent('vmember')
    ]);

    const ownerOnly = await Family.create({
      familyName: 'Owner only',
      ownerParentId: owner._id,
      memberParentIds: [owner._id]
    });
    expect(ownerOnly.memberParentIds.map(String)).toEqual([owner._id.toString()]);

    const secondOwner = await createParent('owner2');
    const shared = await Family.create({
      familyName: 'Shared',
      ownerParentId: secondOwner._id,
      memberParentIds: [secondOwner._id, member._id]
    });
    expect(shared.memberParentIds.map(String)).toEqual([
      secondOwner._id.toString(),
      member._id.toString()
    ]);
  });

  test('invitation stores lifecycle fields and exposes one pending invitation per family index', async () => {
    const owner = await createParent('invite');
    const family = await Family.create({
      familyName: 'Invitation family',
      ownerParentId: owner._id,
      memberParentIds: [owner._id]
    });
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const invitation = await FamilyParentInvitation.create({
      familyId: family._id,
      invitedByParentId: owner._id,
      tokenDigest: 'a'.repeat(64),
      status: 'pending',
      expiresAt
    });

    expect(invitation.status).toBe('pending');
    expect(FamilyParentInvitation.STATUSES).toEqual([
      'pending', 'accepted', 'revoked', 'expired'
    ]);
    await expect(FamilyParentInvitation.create({
      familyId: family._id,
      invitedByParentId: owner._id,
      tokenDigest: 'b'.repeat(64),
      status: 'pending',
      expiresAt
    })).rejects.toMatchObject({ code: 11000 });
  });

  test('membership event accepts only approved immutable actions', async () => {
    const actorParentId = new mongoose.Types.ObjectId();
    const familyId = new mongoose.Types.ObjectId();
    const event = await FamilyMembershipEvent.create({
      familyId,
      action: 'member_joined',
      actorParentId,
      targetParentId: new mongoose.Types.ObjectId()
    });

    expect(FamilyMembershipEvent.ACTIONS).toContain('ownership_transferred');
    await expect(FamilyMembershipEvent.create({
      familyId,
      action: 'unknown_action',
      actorParentId
    })).rejects.toThrow(/action/);

    event.action = 'member_removed';
    await expect(event.save()).rejects.toThrow(/immutable/);
    expect((await FamilyMembershipEvent.findById(event._id)).action).toBe('member_joined');
  });
});

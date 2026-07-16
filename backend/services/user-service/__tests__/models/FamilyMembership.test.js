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

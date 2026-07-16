const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

const Family = require('../../../../common/models/Family');
const FamilyMembershipEvent = require('../../../../common/models/FamilyMembershipEvent');
const FamilyParentInvitation = require('../../../../common/models/FamilyParentInvitation');
const User = require('../../../../common/models/User');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const routes = require('../../routes');
const { createFamilyMembershipService } = require('../../services/familyMembershipService');

process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  return app;
};

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;
const createParent = (overrides = {}) => User.create({
  username: overrides.username || unique('cp'),
  password: 'parent123',
  email: overrides.email || `${unique('cp')}@example.com`,
  name: overrides.name || '共管家长',
  role: 'parent',
  ...overrides
});
const headers = (parent, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: { id: parent._id.toString(), role: 'parent' },
  secret: process.env.GATEWAY_IDENTITY_SECRET
});
const identityHeaders = (user, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: { id: user._id.toString(), role: user.role },
  secret: process.env.GATEWAY_IDENTITY_SECRET
});
const createFamily = async (owner, overrides = {}) => {
  const family = await Family.create({
    familyName: overrides.familyName || '共管家庭',
    timezone: 'Asia/Shanghai',
    ownerParentId: owner._id,
    memberParentIds: [owner._id],
    childIds: overrides.childIds || []
  });
  owner.familyId = family._id;
  owner.parentProfile.familyRole = 'guardian';
  await owner.save();
  return family;
};
const createInvitation = async (app, owner, family) => {
  const path = `/api/families/${family._id}/parent-invitations`;
  return request(app).post(path).set(headers(owner, 'POST', path)).send({});
};

describe('Task 12 parent membership routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  test('TC-T12-INV-001 owner creates one clear token while only digest and audit persist', async () => {
    const owner = await createParent({ name: '家庭所有者' });
    const family = await createFamily(owner);

    const response = await createInvitation(app, owner, family);

    expect(response.status).toBe(201);
    const invitation = response.body.data.invitation;
    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(invitation.expiresAt).getTime() - Date.now()).toBeGreaterThan(71 * 60 * 60 * 1000);
    const stored = await FamilyParentInvitation.findById(invitation.invitationId).lean();
    expect(stored.tokenDigest).toBe(crypto.createHash('sha256').update(invitation.token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(invitation.token);
    expect(await FamilyMembershipEvent.countDocuments({
      familyId: family._id,
      action: 'invitation_created'
    })).toBe(1);

    const activePath = `/api/families/${family._id}/parent-invitations/active`;
    const active = await request(app).get(activePath).set(headers(owner, 'GET', activePath));
    expect(active.status).toBe(200);
    expect(active.body.data.invitation).toEqual(expect.objectContaining({
      invitationId: invitation.invitationId,
      status: 'pending'
    }));
    expect(active.body.data.invitation).not.toHaveProperty('token');
    expect(active.body.data.invitation).not.toHaveProperty('tokenDigest');
  });

  test('TC-T12-INV-002 non-owner cannot create or inspect owner invitation', async () => {
    const owner = await createParent();
    const outsider = await createParent();
    const family = await createFamily(owner);
    const path = `/api/families/${family._id}/parent-invitations`;
    const activePath = `${path}/active`;

    const created = await request(app).post(path).set(headers(outsider, 'POST', path)).send({});
    const listed = await request(app).get(activePath).set(headers(outsider, 'GET', activePath));

    for (const response of [created, listed]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FAMILY_GOVERNANCE_DENIED');
    }
  });

  test('TC-T12-INV-003/004 rejects a second active invitation and replaces an elapsed one', async () => {
    const owner = await createParent();
    const family = await createFamily(owner);
    const first = await createInvitation(app, owner, family);

    const duplicate = await createInvitation(app, owner, family);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('FAMILY_INVITATION_ALREADY_ACTIVE');
    expect(await FamilyParentInvitation.countDocuments({ familyId: family._id, status: 'pending' })).toBe(1);

    await FamilyParentInvitation.updateOne(
      { _id: first.body.data.invitation.invitationId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    const replacement = await createInvitation(app, owner, family);
    expect(replacement.status).toBe(201);
    expect(replacement.body.data.invitation.invitationId).not.toBe(first.body.data.invitation.invitationId);
    expect((await FamilyParentInvitation.findById(first.body.data.invitation.invitationId)).status).toBe('expired');
  });

  test('TC-T12-INV-005 revocation is single-use and emits one event', async () => {
    const owner = await createParent();
    const family = await createFamily(owner);
    const created = await createInvitation(app, owner, family);
    const path = `/api/families/${family._id}/parent-invitations/${created.body.data.invitation.invitationId}`;

    await request(app).delete(path).set(headers(owner, 'DELETE', path)).expect(204);
    const replay = await request(app).delete(path).set(headers(owner, 'DELETE', path));

    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe('FAMILY_INVITATION_NOT_ACTIVE');
    expect(await FamilyMembershipEvent.countDocuments({
      familyId: family._id,
      action: 'invitation_revoked'
    })).toBe(1);
  });

  test('TC-T12-ACCEPT-001 accepts invitation atomically and returns safe parent summaries', async () => {
    const owner = await createParent({ name: '甲家长' });
    const member = await createParent({ name: '乙家长' });
    const family = await createFamily(owner);
    const created = await createInvitation(app, owner, family);
    const token = created.body.data.invitation.token;

    const previewPath = '/api/parent-invitations/preview';
    const preview = await request(app)
      .post(previewPath)
      .set(headers(member, 'POST', previewPath))
      .send({ token });
    expect(preview.status).toBe(200);
    expect(preview.body.data.invitation).toEqual(expect.objectContaining({
      familyName: '共管家庭',
      owner: { name: '甲家长' }
    }));

    const acceptPath = '/api/parent-invitations/accept';
    const accepted = await request(app)
      .post(acceptPath)
      .set(headers(member, 'POST', acceptPath))
      .send({ token, familyRole: 'father' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.family.parents).toEqual([
      expect.objectContaining({ name: '甲家长', isOwner: true }),
      expect.objectContaining({ name: '乙家长', familyRole: 'father', isOwner: false })
    ]);
    expect(accepted.body.data.family.parents[1]).not.toHaveProperty('email');

    const [storedFamily, storedMember] = await Promise.all([
      Family.findById(family._id),
      User.findById(member._id)
    ]);
    expect(storedFamily.memberParentIds.map(String)).toEqual([
      owner._id.toString(), member._id.toString()
    ]);
    expect(storedMember.familyId.toString()).toBe(family._id.toString());
    expect(await FamilyMembershipEvent.countDocuments({ action: 'member_joined' })).toBe(1);

    const familyPath = '/api/families/me';
    const read = await request(app).get(familyPath).set(headers(member, 'GET', familyPath));
    expect(read.body.data.family.parents).toEqual(accepted.body.data.family.parents);
  });

  test('TC-T12-INV-007 preview and accept use the same envelope for an unknown token', async () => {
    const parent = await createParent();
    const token = crypto.randomBytes(32).toString('base64url');
    const expected = {
      success: false,
      error: {
        code: 'FAMILY_INVITATION_NOT_ACTIVE',
        message: 'Invitation is not active',
        details: []
      }
    };
    for (const path of ['/api/parent-invitations/preview', '/api/parent-invitations/accept']) {
      const body = path.endsWith('/accept')
        ? { token, familyRole: 'guardian' }
        : { token };
      const response = await request(app).post(path).set(headers(parent, 'POST', path)).send(body);
      expect(response.status).toBe(409);
      expect(response.body).toEqual(expected);
    }
  });

  test('TC-T12-INV-007 checks inactive invitation before account eligibility', async () => {
    const nonParent = await User.create({
      username: unique('ca'),
      password: 'admin123',
      email: `${unique('ca')}@example.com`,
      name: '非家长账号',
      role: 'admin'
    });
    const token = crypto.randomBytes(32).toString('base64url');

    for (const path of ['/api/parent-invitations/preview', '/api/parent-invitations/accept']) {
      const body = path.endsWith('/accept') ? { token, familyRole: 'guardian' } : { token };
      const response = await request(app)
        .post(path)
        .set(identityHeaders(nonParent, 'POST', path))
        .send(body);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('FAMILY_INVITATION_NOT_ACTIVE');
    }
  });

  test('TC-T12-ACCEPT-002 rejects a non-parent only after resolving a valid invitation', async () => {
    const owner = await createParent();
    const family = await createFamily(owner);
    const created = await createInvitation(app, owner, family);
    const nonParent = await User.create({
      username: unique('ca'),
      password: 'admin123',
      email: `${unique('ca')}@example.com`,
      name: '非家长账号',
      role: 'admin'
    });
    const path = '/api/parent-invitations/accept';

    const response = await request(app)
      .post(path)
      .set(identityHeaders(nonParent, 'POST', path))
      .send({ token: created.body.data.invitation.token, familyRole: 'guardian' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FAMILY_GOVERNANCE_DENIED');
    expect((await FamilyParentInvitation.findById(created.body.data.invitation.invitationId)).status).toBe('pending');
  });

  test('TC-T12-ACCEPT-003/007 rejects an existing member and a full family without mutation', async () => {
    const owner = await createParent();
    const existingMember = await createParent();
    const third = await createParent();
    const candidate = await createParent();
    const otherOwner = await createParent();
    const family = await createFamily(owner);
    const otherFamily = await createFamily(otherOwner);
    existingMember.familyId = otherFamily._id;
    await existingMember.save();
    const created = await createInvitation(app, owner, family);
    const path = '/api/parent-invitations/accept';

    const alreadyMember = await request(app).post(path).set(headers(existingMember, 'POST', path)).send({
      token: created.body.data.invitation.token,
      familyRole: 'guardian'
    });
    expect(alreadyMember.status).toBe(409);
    expect(alreadyMember.body.error.code).toBe('PARENT_ALREADY_IN_FAMILY');

    family.memberParentIds.addToSet(third._id);
    await family.save();
    const full = await request(app).post(path).set(headers(candidate, 'POST', path)).send({
      token: created.body.data.invitation.token,
      familyRole: 'guardian'
    });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('FAMILY_PARENT_LIMIT_REACHED');
    expect((await FamilyParentInvitation.findById(created.body.data.invitation.invitationId)).status).toBe('pending');
  });

  test('TC-T12-ACCEPT-004 hides expired, revoked, and consumed invitation history', async () => {
    const parent = await createParent();
    const owner = await createParent();
    const family = await createFamily(owner);
    const states = [
      { status: 'expired', expiresAt: new Date(Date.now() - 1000) },
      { status: 'revoked', expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() },
      { status: 'accepted', expiresAt: new Date(Date.now() + 60_000), acceptedAt: new Date() }
    ];

    for (const state of states) {
      const token = crypto.randomBytes(32).toString('base64url');
      await FamilyParentInvitation.create({
        familyId: family._id,
        invitedByParentId: owner._id,
        tokenDigest: crypto.createHash('sha256').update(token).digest('hex'),
        ...state
      });

      for (const path of ['/api/parent-invitations/preview', '/api/parent-invitations/accept']) {
        const body = path.endsWith('/accept') ? { token, familyRole: 'guardian' } : { token };
        const response = await request(app).post(path).set(headers(parent, 'POST', path)).send(body);
        expect(response.status).toBe(409);
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'FAMILY_INVITATION_NOT_ACTIVE',
            message: 'Invitation is not active',
            details: []
          }
        });
      }
    }
  });

  test('TC-T12-API-002 rejects unknown invitation and governance fields', async () => {
    const owner = await createParent();
    const member = await createParent();
    const family = await createFamily(owner);
    const invitation = await createInvitation(app, owner, family);
    const cases = [
      ['post', '/api/parent-invitations/preview', headers(member, 'POST', '/api/parent-invitations/preview'), {
        token: invitation.body.data.invitation.token,
        actorParentId: member._id.toString()
      }],
      ['post', '/api/parent-invitations/accept', headers(member, 'POST', '/api/parent-invitations/accept'), {
        token: invitation.body.data.invitation.token,
        familyRole: 'guardian',
        familyId: family._id.toString()
      }],
      ['patch', `/api/families/${family._id}/owner`, headers(owner, 'PATCH', `/api/families/${family._id}/owner`), {
        newOwnerParentId: member._id.toString(),
        ownerParentId: member._id.toString()
      }]
    ];

    for (const [method, path, signedHeaders, body] of cases) {
      const response = await request(app)[method](path).set(signedHeaders).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect((await Family.findById(family._id)).ownerParentId.toString()).toBe(owner._id.toString());
  });

  test('TC-T12-PROJ-001 either parent creating a child updates both parent projections', async () => {
    const owner = await createParent();
    const member = await createParent();
    const family = await createFamily(owner);
    const invite = await createInvitation(app, owner, family);
    const acceptPath = '/api/parent-invitations/accept';
    await request(app).post(acceptPath).set(headers(member, 'POST', acceptPath)).send({
      token: invite.body.data.invitation.token,
      familyRole: 'guardian'
    }).expect(200);

    const childPath = '/api/children';
    const childResponse = await request(app)
      .post(childPath)
      .set(headers(member, 'POST', childPath))
      .send({ name: '共管孩子', grade: 3 });
    expect(childResponse.status).toBe(201);
    const childId = childResponse.body.data.child.childId;

    const [ownerAfter, memberAfter] = await Promise.all([
      User.findById(owner._id),
      User.findById(member._id)
    ]);
    for (const parent of [ownerAfter, memberAfter]) {
      expect(parent.children.map(String)).toEqual([childId]);
      expect(parent.parentProfile.defaultChildId.toString()).toBe(childId);
    }
  });

  test('TC-T12-GOV-002/005 owner transfers ownership and new owner removes the old owner', async () => {
    const owner = await createParent({ name: '原所有者' });
    const member = await createParent({ name: '新所有者' });
    const family = await createFamily(owner);
    const invite = await createInvitation(app, owner, family);
    const acceptPath = '/api/parent-invitations/accept';
    await request(app).post(acceptPath).set(headers(member, 'POST', acceptPath)).send({
      token: invite.body.data.invitation.token,
      familyRole: 'mother'
    }).expect(200);

    const ownerPath = `/api/families/${family._id}/owner`;
    const transferred = await request(app)
      .patch(ownerPath)
      .set(headers(owner, 'PATCH', ownerPath))
      .send({ newOwnerParentId: member._id.toString() });
    expect(transferred.status).toBe(200);
    expect(transferred.body.data.family.ownerParentId).toBe(member._id.toString());

    const removePath = `/api/families/${family._id}/members/${owner._id}`;
    await request(app).delete(removePath).set(headers(member, 'DELETE', removePath)).expect(204);
    const formerOwner = await User.findById(owner._id);
    expect(formerOwner.familyId).toBeUndefined();
    expect(formerOwner.children).toEqual([]);
    expect(await FamilyMembershipEvent.countDocuments({ familyId: family._id })).toBe(4);
  });

  test('TC-T12-GOV-001/003/004 enforces owner governance and allows member leave', async () => {
    const owner = await createParent();
    const member = await createParent();
    const family = await createFamily(owner);
    const invite = await createInvitation(app, owner, family);
    const acceptPath = '/api/parent-invitations/accept';
    await request(app).post(acceptPath).set(headers(member, 'POST', acceptPath)).send({
      token: invite.body.data.invitation.token,
      familyRole: 'guardian'
    }).expect(200);

    const ownerLeavePath = `/api/families/${family._id}/members/me`;
    const ownerLeave = await request(app)
      .delete(ownerLeavePath)
      .set(headers(owner, 'DELETE', ownerLeavePath));
    expect(ownerLeave.status).toBe(409);
    expect(ownerLeave.body.error.code).toBe('OWNER_TRANSFER_REQUIRED');

    const transferPath = `/api/families/${family._id}/owner`;
    const nonOwnerTransfer = await request(app)
      .patch(transferPath)
      .set(headers(member, 'PATCH', transferPath))
      .send({ newOwnerParentId: owner._id.toString() });
    expect(nonOwnerTransfer.status).toBe(403);
    expect(nonOwnerTransfer.body.error.code).toBe('FAMILY_GOVERNANCE_DENIED');

    const memberLeave = await request(app)
      .delete(ownerLeavePath)
      .set(headers(member, 'DELETE', ownerLeavePath));
    expect(memberLeave.status).toBe(204);
    expect((await Family.findById(family._id)).memberParentIds.map(String)).toEqual([owner._id.toString()]);
    expect((await User.findById(member._id)).familyId).toBeUndefined();
    expect(await FamilyMembershipEvent.countDocuments({ action: 'member_left' })).toBe(1);
  });

  test('TC-T12-ACCEPT-006 rolls back family and user writes when event persistence fails', async () => {
    const owner = await createParent();
    const member = await createParent();
    const family = await createFamily(owner);
    const created = await createInvitation(app, owner, family);
    const failingService = createFamilyMembershipService({
      EventModel: { create: jest.fn().mockRejectedValue(new Error('injected event failure')) }
    });

    await expect(failingService.acceptInvitation({
      actorParentId: member._id,
      token: created.body.data.invitation.token,
      familyRole: 'guardian'
    })).rejects.toThrow('injected event failure');

    expect((await Family.findById(family._id)).memberParentIds.map(String)).toEqual([owner._id.toString()]);
    expect((await User.findById(member._id)).familyId).toBeUndefined();
    expect((await FamilyParentInvitation.findById(created.body.data.invitation.invitationId)).status).toBe('pending');
  });

  test('TC-T12-GOV-006 rejects invalid transfer targets without changing ownership', async () => {
    const owner = await createParent();
    const member = await createParent();
    const outsider = await createParent();
    const family = await createFamily(owner);
    family.memberParentIds.addToSet(member._id);
    await family.save();
    const path = `/api/families/${family._id}/owner`;

    const cases = [
      { newOwnerParentId: owner._id.toString(), status: 404 },
      { newOwnerParentId: outsider._id.toString(), status: 404 },
      { newOwnerParentId: 'not-an-object-id', status: 400 }
    ];
    for (const testCase of cases) {
      const response = await request(app)
        .patch(path)
        .set(headers(owner, 'PATCH', path))
        .send({ newOwnerParentId: testCase.newOwnerParentId });
      expect(response.status).toBe(testCase.status);
      expect((await Family.findById(family._id)).ownerParentId.toString()).toBe(owner._id.toString());
    }
  });

  test('TC-T12-GOV-007 rolls back removal, leave, and transfer when event persistence fails', async () => {
    for (const operation of ['remove', 'leave', 'transfer']) {
      const owner = await createParent();
      const member = await createParent();
      const family = await createFamily(owner);
      family.memberParentIds.addToSet(member._id);
      await family.save();
      member.familyId = family._id;
      await member.save();
      const failingService = createFamilyMembershipService({
        EventModel: { create: jest.fn().mockRejectedValue(new Error(`injected ${operation} failure`)) }
      });

      let work;
      if (operation === 'remove') {
        work = failingService.removeFamilyMember({
          actorParentId: owner._id,
          familyId: family._id,
          targetParentId: member._id
        });
      } else if (operation === 'leave') {
        work = failingService.leaveFamily({ actorParentId: member._id, familyId: family._id });
      } else {
        work = failingService.transferOwnership({
          actorParentId: owner._id,
          familyId: family._id,
          newOwnerParentId: member._id
        });
      }
      await expect(work).rejects.toThrow(`injected ${operation} failure`);

      const [storedFamily, storedMember] = await Promise.all([
        Family.findById(family._id),
        User.findById(member._id)
      ]);
      expect(storedFamily.ownerParentId.toString()).toBe(owner._id.toString());
      expect(storedFamily.memberParentIds.map(String)).toEqual([
        owner._id.toString(), member._id.toString()
      ]);
      expect(storedMember.familyId.toString()).toBe(family._id.toString());
    }
  });

  test('TC-T12-ACCEPT-005 concurrent acceptance has exactly one winner', async () => {
    const owner = await createParent();
    const [first, second] = await Promise.all([createParent(), createParent()]);
    const family = await createFamily(owner);
    const invite = await createInvitation(app, owner, family);
    const token = invite.body.data.invitation.token;
    const path = '/api/parent-invitations/accept';
    const accept = (parent) => request(app)
      .post(path)
      .set(headers(parent, 'POST', path))
      .send({ token, familyRole: 'guardian' });

    const responses = await Promise.all([accept(first), accept(second)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await Family.findById(family._id)).memberParentIds).toHaveLength(2);
    expect(await FamilyMembershipEvent.countDocuments({ action: 'member_joined' })).toBe(1);
    expect(await User.countDocuments({ _id: { $in: [first._id, second._id] }, familyId: family._id })).toBe(1);
  });
});

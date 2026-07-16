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

  test('TC-T12-INV-007 preview and accept use the same inactive envelope', async () => {
    const parent = await createParent();
    const unknownToken = crypto.randomBytes(32).toString('base64url');
    const bodies = [];

    for (const path of ['/api/parent-invitations/preview', '/api/parent-invitations/accept']) {
      const body = path.endsWith('/accept')
        ? { token: unknownToken, familyRole: 'guardian' }
        : { token: unknownToken };
      const response = await request(app).post(path).set(headers(parent, 'POST', path)).send(body);
      expect(response.status).toBe(409);
      bodies.push(response.body);
    }

    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[0]).toEqual({
      success: false,
      error: {
        code: 'FAMILY_INVITATION_NOT_ACTIVE',
        message: 'Invitation is not active',
        details: []
      }
    });
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

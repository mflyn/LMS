const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const User = require('../../common/models/User');
const { createTask11ApiClient } = require('../task11/apiClient');
const { createFamilyRuntime } = require('../task11/serviceRuntime');

const expectSuccess = (response, status) => {
  expect(response.status).toBe(status);
  expect(response.data?.success).toBe(true);
  return response.data.data;
};

const registerParent = async (api, suffix, name) => expectSuccess(await api.registerParent({
  username: `task12_${suffix}`,
  name,
  email: `task12-${suffix}@example.com`,
  password: 'FamilyPass123',
  role: 'parent'
}), 201);

const uploadImage = async (client, childId) => {
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 30, g: 110, b: 170 } }
  }).png().toBuffer();
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'co-parent.png');
  form.append('purpose', 'growth_evidence');
  form.append('childId', childId);
  return client.post('/api/media', form);
};

describe('Task 12 real-service co-parent flow', () => {
  let runtime;
  let api;

  beforeAll(async () => {
    runtime = await createFamilyRuntime();
    api = createTask11ApiClient({ baseURL: runtime.gatewayUrl });
  });

  afterAll(async () => {
    if (runtime) await runtime.stop();
  });

  test('TC-T12-FLOW-001 joins, co-manages, transfers, removes, and revokes stale access', async () => {
    const ownerRegistration = await registerParent(api, 'owner', 'Task 12 Owner');
    const memberRegistration = await registerParent(api, 'member', 'Task 12 Member');
    const owner = api.asParent(ownerRegistration.token);
    const member = api.asParent(memberRegistration.token);

    for (const token of [ownerRegistration.token, memberRegistration.token]) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      expect(payload).toEqual(expect.objectContaining({ role: 'parent' }));
      expect(payload).not.toHaveProperty('familyId');
    }

    const family = expectSuccess(await owner.post('/api/families', {
      familyName: 'Task 12 Shared Family',
      timezone: 'Asia/Shanghai',
      familyRole: 'mother'
    }), 201).family;
    const child = expectSuccess(await owner.post('/api/children', {
      name: '共同成长孩子',
      grade: 3
    }), 201).child;

    const invitation = expectSuccess(await owner.post(
      `/api/families/${family.familyId}/parent-invitations`,
      {}
    ), 201).invitation;
    expect(invitation.token).toEqual(expect.any(String));

    const active = expectSuccess(await owner.get(
      `/api/families/${family.familyId}/parent-invitations/active`
    ), 200).invitation;
    expect(active).toEqual(expect.objectContaining({ invitationId: invitation.invitationId, status: 'pending' }));
    expect(active).not.toHaveProperty('token');

    const preview = expectSuccess(await member.post('/api/parent-invitations/preview', {
      token: invitation.token
    }), 200).invitation;
    expect(preview).toEqual(expect.objectContaining({ familyName: 'Task 12 Shared Family' }));
    expect(preview.owner).toEqual({ name: 'Task 12 Owner' });

    const acceptedFamily = expectSuccess(await member.post('/api/parent-invitations/accept', {
      token: invitation.token,
      familyRole: 'father'
    }), 200).family;
    expect(acceptedFamily.memberParentIds).toEqual(expect.arrayContaining([
      ownerRegistration.user.id,
      memberRegistration.user.id
    ]));
    expect(acceptedFamily.parents).toEqual(expect.arrayContaining([
      expect.objectContaining({ parentId: ownerRegistration.user.id, name: 'Task 12 Owner', isOwner: true }),
      expect.objectContaining({ parentId: memberRegistration.user.id, name: 'Task 12 Member', isOwner: false })
    ]));
    for (const parent of acceptedFamily.parents) {
      expect(Object.keys(parent).sort()).toEqual(['familyRole', 'isOwner', 'name', 'parentId']);
    }

    const memberFamily = expectSuccess(await member.get('/api/families/me'), 200);
    expect(memberFamily.family.familyId).toBe(family.familyId);
    expect(memberFamily.children.map(({ childId }) => childId)).toContain(child.childId);

    const task = expectSuccess(await member.post('/api/growth-tasks', {
      childId: child.childId,
      dimension: 'physical',
      title: '共同完成跳绳',
      taskType: 'exercise',
      dueDate: '2026-07-16',
      estimatedMinutes: 20,
      targetAmount: 300,
      unit: '个'
    }), 201).task;
    expect(task.childId).toBe(child.childId);

    expectSuccess(await member.post('/api/growth-logs', {
      childId: child.childId,
      date: '2026-07-16',
      dimension: 'physical',
      content: '第二家长记录跳绳训练',
      durationMinutes: 20
    }), 201);
    expectSuccess(await member.post('/api/mistakes', {
      childId: child.childId,
      subject: '数学',
      reason: 'calculation',
      correctAnswer: '42'
    }), 201);
    expectSuccess(await member.get('/api/notifications/settings'), 200);
    expectSuccess(await member.get(
      `/api/reports/weekly?childId=${child.childId}&weekStart=2026-07-13`
    ), 200);
    expectSuccess(await member.get(`/api/rewards?childId=${child.childId}`), 200);
    expectSuccess(await uploadImage(member, child.childId), 201);

    const transferred = expectSuccess(await owner.patch(`/api/families/${family.familyId}/owner`, {
      newOwnerParentId: memberRegistration.user.id
    }), 200).family;
    expect(transferred.ownerParentId).toBe(memberRegistration.user.id);

    expect((await member.delete(
      `/api/families/${family.familyId}/members/${ownerRegistration.user.id}`
    )).status).toBe(204);

    const staleFamily = await owner.get('/api/families/me');
    expect(staleFamily.status).toBe(404);
    const staleTaskList = await owner.get(`/api/growth-tasks?childId=${child.childId}`);
    expect(staleTaskList.status).toBe(403);
    const staleMedia = await uploadImage(owner, child.childId);
    expect(staleMedia.status).toBe(403);

    const retainedTask = expectSuccess(await member.get(`/api/growth-tasks/${task.taskId}`), 200).task;
    expect(retainedTask.title).toBe('共同完成跳绳');
    const formerOwner = await User.findById(ownerRegistration.user.id).lean();
    expect(formerOwner.children || []).toEqual([]);
    expect(formerOwner.familyId).toBeFalsy();
  });

  test('TC-T12-FLOW-002 keeps preview and accept invalid-token responses indistinguishable', async () => {
    const registration = await registerParent(api, 'invalid', 'Task 12 Invalid Token Parent');
    const client = api.asParent(registration.token);
    const token = 'A'.repeat(43);

    const preview = await client.post('/api/parent-invitations/preview', { token });
    const accept = await client.post('/api/parent-invitations/accept', { token, familyRole: 'guardian' });

    expect(preview.status).toBe(409);
    expect(accept.status).toBe(409);
    expect(preview.data.error).toEqual(accept.data.error);
    expect(preview.data.error).toEqual({
      code: 'FAMILY_INVITATION_NOT_ACTIVE',
      message: 'Invitation is not active',
      details: []
    });
  });
});

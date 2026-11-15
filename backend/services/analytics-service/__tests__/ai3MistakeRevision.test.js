process.env.JWT_SECRET = 'synthetic-ai3-jwt-secret-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1/synthetic-unused-config';
process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-ai3-gateway-secret-at-least-32-characters';
const express = require('express');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { createIdentityHeaders, resetIdentityNonceStore } = require('../../../common/middleware/gatewayIdentity');
const { createFamilyMistakesRouter } = require('../routes/familyMistakes');
const { id, Mistake, Event, Family, User, seed, mediaService } = require('./helpers/ai3MistakeFixtures');
const { request, close } = createHttpTestHarness();
afterEach(close);
beforeAll(async () => { for (const model of [Mistake, Event, Family, User]) await model.init(); });
let f, app;
beforeEach(async () => {
  resetIdentityNonceStore(); f = await seed();
  app = express(); app.use(express.json()); app.use('/api/mistakes', createFamilyMistakesRouter());
});
async function patch(body) {
  const url = `/api/mistakes/${f.targetId}`;
  return (await request(app)).patch(url).set(createIdentityHeaders({ method: 'PATCH', originalUrl: url,
    user: { id: f.actorId, role: 'parent' }, secret: process.env.GATEWAY_IDENTITY_SECRET })).send(body);
}
const current = () => Mistake.findById(f.targetId).select('+mediaReferenceState +mediaBindingOperationId').lean();
test.each([{ reviewed: true }, { mastered: true }, { corrected: false }, { knowledgePointId: '665000000000000000000099' },
  { subject: 'english' }, { reviewReminderDate: '2026-11-01' }, { parentNote: 'Updated synthetic note' }])(
  'legacy public PATCH advances missing stateRevision atomically for %j', async body => {
    await Mistake.collection.updateOne({ _id: f.mistake._id }, { $unset: { stateRevision: '' } });
    expect((await patch(body)).status).toBe(200);
    expect((await current()).stateRevision).toBe(1);
  });
test('concurrent public patches preserve both changes and advance revision twice', async () => {
  const responses = await Promise.all([patch({ reviewed: true }), patch({ mastered: true })]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  expect(await current()).toMatchObject({ stateRevision: 2, reviewed: true, mastered: true });
});
test.each(['stateRevision', 'effectId', 'finalReviewId', 'finalReviewHash', 'reviewedByParentId', 'ai3Evidence'])(
  'public PATCH cannot forge %s', async key => {
    expect((await patch({ [key]: key === 'stateRevision' ? 99 : id() })).status).toBe(403);
    expect(await Event.countDocuments()).toBe(0);
  });
test('mixed media mutation increments revision on pending claim and final state publication', async () => {
  const { client, service } = mediaService();
  client.prepare.mockRejectedValueOnce(new Error('Synthetic network loss'));
  await expect(service.mutate({ mistake: f.mistake, mistakePatch: { reviewed: true }, mediaPatch: { questionMediaIds: [id()] } }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await current()).toMatchObject({ stateRevision: 1, mediaReferenceState: 'pending', reviewed: false });
  await service.resume(f.targetId);
  expect(await current()).toMatchObject({ stateRevision: 2, mediaReferenceState: 'bound', reviewed: true });
});
test('stable media rejection increments revision again when pending claim is rolled back', async () => {
  const { client, service } = mediaService();
  client.prepare.mockRejectedValueOnce(Object.assign(new Error('Synthetic invalid image'), { status: 404, code: 'RESOURCE_NOT_FOUND' }));
  await expect(service.mutate({ mistake: f.mistake, mistakePatch: { mastered: true }, mediaPatch: { questionMediaIds: [id()] } }))
    .rejects.toMatchObject({ status: 404 });
  expect(await current()).toMatchObject({ stateRevision: 2, mediaReferenceState: 'none', mastered: false });
});
test('media removal stays revisioned pending until old binding release finishes', async () => {
  const oldMedia = id();
  await Mistake.updateOne({ _id: f.targetId }, { $set: { questionMediaIds: [oldMedia], questionMediaId: oldMedia,
    mediaReferenceState: 'bound', mediaReferenceBindings: [{ field: 'questionMediaId', mediaId: oldMedia, bindingOperationId: 'old' }] } });
  const { client, service } = mediaService();
  client.unbind.mockImplementationOnce(async q => {
    expect(await current()).toMatchObject({ stateRevision: 2, mediaReferenceState: 'pending', reviewed: true });
    return q.references.map(r => ({ ...r, state: 'released' }));
  });
  await service.mutate({ mistake: f.mistake, mistakePatch: { reviewed: true }, mediaPatch: { questionMediaIds: [] } });
  expect(await current()).toMatchObject({ stateRevision: 3, mediaReferenceState: 'none' });
});
test('plain PATCH cannot overwrite the pending mixed state', async () => {
  const { client, service } = mediaService();
  client.prepare.mockRejectedValueOnce(new Error('Synthetic network loss'));
  await expect(service.mutate({ mistake: f.mistake, mistakePatch: { reviewed: true }, mediaPatch: { questionMediaIds: [id()] } })).rejects.toBeDefined();
  expect((await patch({ reviewed: false })).status).toBe(409);
  expect((await current()).stateRevision).toBe(1);
});
test('media claim refuses revision overflow without starting remote work', async () => {
  await Mistake.collection.updateOne({ _id: f.mistake._id }, { $set: { stateRevision: Number.MAX_SAFE_INTEGER } });
  const { client, service } = mediaService();
  await expect(service.mutate({ mistake: f.mistake, mediaPatch: { questionMediaIds: [id()] } })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await current()).toMatchObject({ stateRevision: Number.MAX_SAFE_INTEGER, mediaReferenceState: 'none' });
  expect(client.prepare).not.toHaveBeenCalled();
});

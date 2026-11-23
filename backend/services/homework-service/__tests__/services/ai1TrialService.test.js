const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const M = require('../../models/Ai1');
const { createAi1Service } = require('../../services/ai1Service');
const { sha } = require('../../services/ai1Contract');
const oid = () => String(new mongoose.Types.ObjectId());
const command = () => ({ schemaVersion: 'ai1-min-v2', operationId: randomUUID() });
let parent, other, child, family, profile, config, service, client, trial, clock, profileRead;
const create = () => service.create({ identity: parent, body: { ...command(), childId: child,
  source: { type: 'task', id: oid() }, input: { questionText: '124 * 23', answerText: null, parentContext: '' },
  chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
    textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true } });
const confirmation = c => ({ ...command(), expectedCycleStateVersion: c.cycle.stateVersion,
  generationInputHash: c.preview.generationInputHash, modelProfileVersion: c.preview.modelProfileVersion,
  pricingProfileVersion: c.preview.pricingProfileVersion, feeMode: 'estimate_only',
  estimateMethodVersion: c.preview.estimateMethodVersion, feeNoticeVersion: c.preview.feeNoticeVersion,
  expectedEstimatedReservationMicros: c.preview.estimatedReservationMicros,
  estimateAcknowledged: true, externalSendConfirmed: true });
const generate = (c, body = confirmation(c)) => service.generate({ identity: parent, cycleId: c.cycle.id, body });
const evidence = (j, usage = { inputTokens: 100, outputTokens: 50 }) => ({ remoteOperationId: j.remoteOperationId,
  generationInputHash: j.preview.generationInputHash, modelProfileVersion: j.preview.modelProfileVersion,
  pricingProfileVersion: j.preview.pricingProfileVersion, sendNotAfter: j.sendNotAfter.toISOString(),
  status: 'succeeded', text: 'Synthetic parent draft.', usage });
const remote = (j, patch = {}) => ({ schemaVersion: 'ai1-provider-operation-v2', feeMode: 'estimate_only',
  remoteOperationId: j.remoteOperationId, requestHash: j.remoteRequestHash,
  modelProfileVersion: j.preview.modelProfileVersion, pricingProfileVersion: j.preview.pricingProfileVersion,
  sendNotAfter: j.preview.sendNotAfter, status: 'succeeded', sendClaimed: true, error: null,
  result: { text: 'Synthetic draft.', contentHash: sha('Synthetic draft.') }, usage: { inputTokens: 100, outputTokens: 20 },
  updatedAt: new Date(clock).toISOString(), ...patch });
beforeAll(async () => { for (const model of [...Object.values(M), Family, User]) await model.init(); });
beforeEach(async () => {
  clock = Date.parse('2026-11-21T01:00:00Z'); profileRead = () => {};
  parent = { id: oid(), role: 'parent' }; other = { id: oid(), role: 'parent' }; child = oid();
  family = await Family.create({ familyName: 'Synthetic trial', ownerParentId: parent.id,
    memberParentIds: [parent.id, other.id], childIds: [child], timezone: 'UTC' });
  await User.collection.insertMany([parent, other].map(p => ({ _id: new mongoose.Types.ObjectId(p.id),
    role: 'parent', username: p.id, email: `${p.id}@example.test` })));
  await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(child), role: 'student', familyId: family._id,
    username: child, email: `${child}@example.test` });
  profile = { feeMode: 'estimate_only', model: 'synthetic-no-provider', modelProfileVersion: 'trial-model-1',
    pricingProfileVersion: 'trial-price-1', inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000,
    checkedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-12-02T00:00:00.000Z', callWindowMs: 60000, clockMarginMs: 5000,
    sourceReference: 'https://example.test/synthetic-price' };
  config = { enabled: true, continuousStore: true };
  trial = { authorizationVersion: 'synthetic-trial-1', maxSubmissions: 3 };
  client = { put: jest.fn(), get: jest.fn() };
  service = createAi1Service({ now: () => clock, getProfile: () => { profileRead(); return profile; }, getRuntime: () => config,
    getTrial: () => trial,
    getLimits: () => ({ singleMicros: 184320, dayMicros: 2000000, monthMicros: 2000000, experimentMicros: 2000000 }),
    operationClient: client, sourceReader: { require: async q => ({ id: q.sourceTaskId,
      familyId: String(family._id), childId: child, subject: 'math' }) } });
});
test('trial confirmation reserves one immutable command and replay consumes no second allowance', async () => {
  const c = await create(), b = confirmation(c), first = await generate(c, b);
  expect(c.preview).toMatchObject({ feeMode: 'estimate_only', referenceInputTokens: 8192 });
  expect(c.preview).not.toHaveProperty('reservedCeilingMicros');
  expect(first.job.budget).toMatchObject({ feeMode: 'estimate_only', estimatedReservationMicros: 184320 });
  expect((await generate(c, b)).job.id).toBe(first.job.id);
  expect(await M.Job.countDocuments()).toBe(1);
  expect(await M.Reservation.countDocuments()).toBe(1);
  await expect(generate(c, { ...b, estimateAcknowledged: false })).rejects.toBeDefined();
  expect(client.put).not.toHaveBeenCalled();
});
test('overestimate retains a valid candidate, charges full usage and atomically stops later sends', async () => {
  const c = await create(), g = await generate(c);
  await service.claim({ identity: parent, jobId: g.job.id });
  const j = await M.Job.findById(g.job.id).lean();
  const result = await service.applyOutcome({ jobId: j._id, evidence: evidence(j, { inputTokens: 30000, outputTokens: 100 }) });
  expect(result.artifact.status).toBe('candidate');
  const view = (await service.getJob({ identity: parent, jobId: g.job.id })).job;
  expect(view.budget.usagePricedMicros).toBe(272700);
  expect(view.sendBlocked).toBe(true);
  expect((await M.Account.findById('experiment').lean()).halted).toBe(true);
  const next = await create();
  await expect(generate(next)).rejects.toBeDefined();
  expect(await M.Reservation.countDocuments()).toBe(1);
  expect(client.put).not.toHaveBeenCalled();
});
test('unknown fee retains reservation and candidate; terminal replay does not release or charge twice', async () => {
  const c = await create(), g = await generate(c);
  await service.claim({ identity: parent, jobId: g.job.id });
  const j = await M.Job.findById(g.job.id).lean(), e = evidence(j, null);
  const a = await service.applyOutcome({ jobId: j._id, evidence: e });
  const b = await service.applyOutcome({ jobId: j._id, evidence: e });
  expect(b.artifact.id).toBe(a.artifact.id);
  const r = await M.Reservation.findById(j.reservationId).lean();
  expect(r).toMatchObject({ state: 'reserved_unknown', settledMicros: null, reservedMicros: 184320 });
  expect((await M.Account.findById('experiment').lean()).halted).toBe(true);
  expect(await M.Artifact.countDocuments()).toBe(1);
});
test('lost response halts sending; original actor recovery only queries the same remote mapping', async () => {
  const c = await create(), g = await generate(c);
  client.put.mockRejectedValueOnce(new Error('Synthetic response lost'));
  const request = { identity: parent, jobId: g.job.id, body: command() };
  await expect(service.recover(request)).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
  const unknown = await M.Job.findById(g.job.id).lean();
  expect(unknown.status).toBe('unknown');
  expect((await M.Account.findById('experiment').lean()).halted).toBe(true);
  client.get.mockRejectedValueOnce(new Error('Still unknown'));
  await expect(service.recover(request)).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
  expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).toHaveBeenCalledTimes(1);
  expect(String(client.get.mock.calls[0][0]._id)).toBe(g.job.id);
  expect((await M.Job.findById(g.job.id).lean()).remoteOperationId).toBe(unknown.remoteOperationId);
  await expect(service.recover({ ...request, identity: other })).rejects.toMatchObject({ code: 'AI_ORIGINAL_ACTOR_REQUIRED' });
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: other.id, memberParentIds: [other.id] } });
  await expect(service.recover(request)).rejects.toMatchObject({ statusCode: 403 });
  expect(client.get).toHaveBeenCalledTimes(1);
});
test('reliable original outcome reconciles while sending is disabled without clearing the unknown halt', async () => {
  const c = await create(), g = await generate(c);
  client.put.mockRejectedValueOnce(new Error('Synthetic lost response'));
  const request = { identity: parent, jobId: g.job.id, body: command() };
  await expect(service.recover(request)).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
  profile = null; trial = null; config.enabled = false;
  client.get.mockImplementation(j => remote(j));
  const result = await service.recover(request);
  expect(result.job.status).toBe('succeeded');
  expect(result.job.budget).toMatchObject({ state: 'settled', usagePricedMicros: 1440 });
  expect(result.job.sendBlocked).toBe(true);
  expect((await M.Account.findById('experiment').lean()).trialUsedSubmissions).toBe(1);
  expect(client.put).toHaveBeenCalledTimes(1);
  expect((await service.getCycle({ identity: parent, cycleId: c.cycle.id })).preview).toEqual(c.preview);
});
test('outcome transaction failure retains slot and unknown fee; query recovery creates only one candidate', async () => {
  const c = await create(), g = await generate(c);
  client.put.mockImplementation(j => remote(j)); client.get.mockImplementation(j => remote(j));
  const request = { identity: parent, jobId: g.job.id, body: command() };
  const fail = jest.spyOn(M.Artifact, 'create').mockRejectedValueOnce(new Error('Synthetic local write failure'));
  try { await expect(service.recover(request)).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' }); }
  finally { fail.mockRestore(); }
  expect(await M.Artifact.countDocuments()).toBe(0);
  expect(String((await M.Slot.findById('global').lean()).jobId)).toBe(g.job.id);
  expect((await M.Account.findById('experiment').lean()).halted).toBe(true);
  expect((await service.recover(request)).job.status).toBe('succeeded');
  expect(await M.Artifact.countDocuments()).toBe(1);
  expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).toHaveBeenCalledTimes(1);
});
test.each([{ inputTokens: -1, outputTokens: 1 }, { inputTokens: 100, outputTokens: 4097 }])(
  'invalid usage %j stops subsequent sends without refund or replacement UUID', async usage => {
    const c = await create(), g = await generate(c);
    client.put.mockImplementation(j => remote(j, { usage }));
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() }))
      .rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
    expect((await service.getJob({ identity: parent, jobId: g.job.id })).job.budget)
      .toMatchObject({ state: 'reserved_unknown', usagePricedMicros: null });
    expect((await M.Account.findById('experiment').lean()).halted).toBe(true);
    expect(await M.Job.countDocuments()).toBe(1); expect(client.put).toHaveBeenCalledTimes(1);
  });
test('old reserved command is not upgraded or automatically refunded when trial configuration appears', async () => {
  delete profile.feeMode; delete profile.sourceReference; trial = null;
  const request = { ...command(), schemaVersion: 'ai1-min-v1', childId: child, source: { type: 'task', id: oid() },
    input: { questionText: '124 * 23', answerText: null, parentContext: '' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic',
      chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true };
  const c = await service.create({ identity: parent, body: request });
  const g = await generate(c, { schemaVersion: 'ai1-min-v1', operationId: randomUUID(), expectedCycleStateVersion: 1,
    generationInputHash: c.preview.generationInputHash, modelProfileVersion: c.preview.modelProfileVersion,
    pricingProfileVersion: c.preview.pricingProfileVersion, maxAuthorizedCostMicros: c.preview.reservedCeilingMicros,
    externalSendConfirmed: true });
  trial = { authorizationVersion: 'synthetic-trial-1', maxSubmissions: 3 }; profile.feeMode = 'estimate_only';
  profile.sourceReference = 'https://example.test/price';
  const before = await M.Job.findById(g.job.id).lean();
  await expect(service.claim({ identity: parent, jobId: g.job.id })).rejects.toMatchObject({ code: 'AI_PROFILE_UNAVAILABLE' });
  expect(await M.Job.findById(g.job.id).lean()).toEqual(before);
  expect((await M.Reservation.findOne().lean()).state).toBe('reserved');
  expect((await service.create({ identity: parent, body: request })).preview).toEqual(c.preview);
  expect(client.put).not.toHaveBeenCalled();
});
test('trial expiry during slot acquisition rolls back claim and preserves the already allocated original command', async () => {
  const c = await create(), g = await generate(c); let reads = 0;
  profileRead = () => { if (++reads === 2) clock = Date.parse(c.preview.sendNotAfter) + 1; };
  await expect(service.claim({ identity: parent, jobId: g.job.id })).rejects.toMatchObject({ code: 'AI_PREVIEW_STALE' });
  expect((await M.Job.findById(g.job.id).lean()).status).toBe('reserved');
  expect((await M.Account.findById('experiment').lean()).trialUsedSubmissions).toBe(1);
  expect(await M.Slot.countDocuments({ jobId: { $ne: null } })).toBe(0);
  expect((await M.Reservation.findOne().lean()).state).toBe('reserved');
  expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
});

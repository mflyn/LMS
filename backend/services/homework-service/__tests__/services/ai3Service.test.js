const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai2');
const M = require('../../models/Ai3');
const Budget = require('../../models/Ai1');
const C = require('../../services/ai3Contract');
const { createAi3Service } = require('../../services/ai3Service');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const id = () => String(new mongoose.Types.ObjectId());
const cmd = () => ({ schemaVersion: 'ai3-min-v1', operationId: randomUUID() });
const text = () => ({ instructions: 'Show steps.', exercises: [
  { exerciseId: 'q1', questionText: '132 * 24', answerForParent: 'SECRET_3168', rubricForParent: 'SECRET_RUBRIC' },
  { exerciseId: 'q2', questionText: '203 * 31', answerForParent: 'SECRET_6293', rubricForParent: 'SECRET_RUBRIC' }
] });
let parent, coparent, child, sibling, outsider, family, pkg, attempt, config, sourceReader, service;
const factory = extra => createAi3Service({ getRuntime: () => config, sourceReader, ...extra });
beforeAll(async () => { for (const model of [...Object.values(M), ...Object.values(A), ...Object.values(Budget), Family, User]) await model.init(); });
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic AI3', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  await Family.create({ familyName: 'Other synthetic', ownerParentId: outsider.id, memberParentIds: [outsider.id] });
  for (const a of [child, sibling]) Object.assign(a, { childId: a.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(a => ({ _id: new mongoose.Types.ObjectId(a.id),
    role: a.role, username: a.id, ...(a.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  // Approved AI2 prerequisite fixture, not an AI1-to-AI3 end-to-end acceptance claim.
  const childSnapshot = { questionText: '124 * 23', explanationText: 'Synthetic approved explanation',
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
      textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' } };
  pkg = await A.Package.create({ familyId: family._id, childId: child.id, ai1CycleId: id(),
    source: { type: 'task', id: id(), subject: 'math' }, artifact: { id: id(), version: 1, contentHash: 'a'.repeat(64) },
    childSnapshot, childSnapshotHash: C.hash(childSnapshot), publishedBy: parent.id, publishedAt: new Date(),
    visibility: 'published', learningState: 'approved', stateVersion: 3 });
  attempt = await A.Attempt.create({ familyId: family._id, childId: child.id, packageId: pkg._id, attemptVersion: 1,
    submitCommandId: id(), submittedBy: child.id, submittedAt: new Date(), note: '', mediaIds: [id()], mediaBindings: [],
    payloadHash: 'b'.repeat(64), review: { decision: 'approve', reviewerId: parent.id, reviewedAt: '2026-11-04T00:00:00.000Z' } });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { currentAttemptId: attempt._id, currentAttemptVersion: 1 } });
  config = { enabled: true, continuousStore: true };
  sourceReader = { require: jest.fn(async q => ({ id: q.sourceTaskId || q.sourceMistakeId,
    familyId: String(family._id), childId: child.id, subject: 'math', knowledgePointId: null })) };
  service = factory();
});
const bodyCreate = () => ({ ...cmd(), sourcePackageId: String(pkg._id), expectedSourcePackageVersion: 3,
  sourceAttemptId: String(attempt._id), expectedSourceAttemptVersion: 1, sourceAttemptPayloadHash: attempt.payloadHash,
  sourceReviewHash: C.hash(attempt.review), exerciseCount: 2, knowledgePointId: null });
const create = () => service.create({ identity: parent, body: bodyCreate() });
const revision = r => ({ ...cmd(), expectedRoundVersion: r.stateVersion, expectedContentId: r.currentContentId,
  expectedContentVersion: r.currentContentVersion, expectedContentHash: r.currentContentHash, content: text(), reason: 'Reviewed manually' });
async function candidate() {
  const { round } = await create();
  return service.reviseContent({ identity: parent, roundId: round.id, body: revision(round) });
}
async function publication(r) {
  const { preview } = await service.publicationPreview({ identity: parent, roundId: r.id });
  const { content, childSnapshot, roundId, ...fields } = preview;
  return { ...cmd(), ...fields, childContentConfirmed: true, answersChecked: true };
}
const counts = async () => [await M.Round.countDocuments(), await M.Content.countDocuments(), await M.Command.countDocuments()];

describe('historical source availability', () => {
  const stored = async () => JSON.stringify(await Promise.all(Object.values(M).map(model => model.find().sort({ _id: 1 }).lean())));
  async function published() {
    const { round } = await candidate();
    return (await service.publish({ identity: parent, roundId: round.id, body: await publication(round) })).round;
  }
  test.each(['available', 'missing', 'unavailable'])('parent and child see %s without changing the published snapshot', async availability => {
    const round = await published(), before = await stored();
    sourceReader.availability = jest.fn(async () => availability);
    for (const identity of [parent, child]) {
      const result = await service.getRound({ identity, roundId: round.id });
      expect(result.round.sourceAvailability).toBe(availability);
      expect(result.round.childSnapshot.exercises[0].questionText).toBe('132 * 24');
      expect(sourceReader.availability).toHaveBeenLastCalledWith({ familyId: String(family._id), childId: child.id,
        actorId: identity.id, sourceTaskId: pkg.source.id });
    }
    expect(await stored()).toBe(before);
  });
  test('availability errors do not expose details or replace historical content', async () => {
    const round = await published(), before = await stored();
    sourceReader.availability = jest.fn(async () => { throw new Error('PRIVATE_UPSTREAM_DETAIL'); });
    const result = await service.getRound({ identity: child, roundId: round.id });
    expect(result.round.sourceAvailability).toBe('unavailable');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_UPSTREAM_DETAIL');
    expect(await stored()).toBe(before);
  });
  test.each([outsider => outsider, () => null])('denied identity never reads the source %#', async choose => {
    const round = await published(); sourceReader.availability = jest.fn(async () => 'available');
    await expect(service.getRound({ identity: choose(outsider), roundId: round.id })).rejects.toBeDefined();
    expect(sourceReader.availability).not.toHaveBeenCalled();
  });
  test('trusted source denial rejects the private detail', async () => {
    const round = await published(), before = await stored();
    sourceReader.availability = jest.fn(async () => { throw C.error(403, 'CHILD_ACCESS_DENIED'); });
    await expect(service.getRound({ identity: child, roundId: round.id })).rejects.toMatchObject({ statusCode: 403 });
    expect(await stored()).toBe(before);
  });
  test.each(['pin', 'member', 'ancestor'])('source wait rechecks %s before returning any private snapshot', async change => {
    const round = await published(), before = await stored();
    let release, entered;
    const ready = new Promise(resolve => { entered = resolve; });
    const wait = new Promise(resolve => { release = resolve; });
    sourceReader.availability = jest.fn(async () => { entered(); await wait; return 'available'; });
    const outcome = service.getRound({ identity: change === 'member' ? coparent : child, roundId: round.id })
      .then(value => ({ value }), error => ({ error }));
    try {
      await Promise.race([ready, outcome.then(() => { throw new Error('Read completed before source probe'); })]);
      if (change === 'pin') await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
      else if (change === 'member') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
      else await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' } });
    } finally { release(); }
    expect((await outcome).error).toMatchObject({ statusCode: change === 'pin' ? 401 : change === 'member' ? 403 : 404 });
    expect(await stored()).toBe(before);
  });
});

test.each(['source', 'knowledgePoint'])('a verified realtime %s permission denial stays 403 with no command or source mutation', async port => {
  const rejection = C.error(403, 'CHILD_ACCESS_DENIED');
  const body = bodyCreate(), before = JSON.stringify(await A.Package.findById(pkg._id).lean());
  if (port === 'source') sourceReader.require.mockRejectedValue(rejection);
  else {
    body.knowledgePointId = id();
    service = factory({ knowledgePointReader: { read: async () => { throw rejection; } } });
  }
  await expect(service.create({ identity: parent, body })).rejects.toMatchObject({ statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
  expect(await counts()).toEqual([0, 0, 0]);
  expect(JSON.stringify(await A.Package.findById(pkg._id).lean())).toBe(before);
});
test.each(['source', 'knowledgePoint'])('an unverified %s denial is still a dependency failure', async port => {
  const rejection = C.error(403, 'UNRECOGNIZED_REMOTE_ERROR');
  const body = bodyCreate();
  if (port === 'source') sourceReader.require.mockRejectedValue(rejection);
  else {
    body.knowledgePointId = id();
    service = factory({ knowledgePointReader: { read: async () => { throw rejection; } } });
  }
  await expect(service.create({ identity: parent, body })).rejects.toMatchObject({ statusCode: 503, code: 'SOURCE_SERVICE_UNAVAILABLE' });
  expect(await counts()).toEqual([0, 0, 0]);
});

describe('AI3-C local generation preparation (no transport)', () => {
  let clock, profile, limits, generation;
  beforeEach(async () => {
    clock = Date.parse('2026-11-04T00:00:00Z');
    profile = { model: 'synthetic-only', modelProfileVersion: 'synthetic-v1', pricingProfileVersion: 'synthetic-price-v1',
      inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000,
      checkedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-11-05T00:00:00.000Z', callWindowMs: 60000, clockMarginMs: 5000 };
    limits = { singleMicros: 184320, dayMicros: 368640, monthMicros: 737280, experimentMicros: 1000000 };
    generation = extra => factory({ now: () => clock, getProfile: () => profile, getLimits: () => limits, ...extra });
    service = generation();
  });
  async function ready() {
    const { round } = await create();
    const { preview } = await service.generationPreview({ identity: parent, roundId: round.id });
    return { round, preview, body: { ...cmd(), expectedRoundVersion: round.stateVersion,
      generationInputHash: preview.generationInputHash, modelProfileVersion: preview.modelProfileVersion,
      pricingProfileVersion: preview.pricingProfileVersion, maxAuthorizedCostMicros: preview.reservedCeilingMicros,
      externalSendConfirmed: true, deidentifiedConfirmed: true } };
  }
  const send = (x, s = service, identity = parent) => s.generate({ identity, roundId: x.round.id, body: x.body });
  const state = async () => JSON.stringify(await Promise.all([M.Round, M.Command, Budget.Account, Budget.Reservation, Budget.Slot]
    .map(m => m.find().sort({ _id: 1 }).lean())));
  describe('AI3-D remote settlement with a synthetic operation port', () => {
    let remote, client;
    const outcome = (c, overrides = {}) => ({ remoteOperationId: c.generation.remoteOperationId,
      requestHash: c.generation.remoteRequestHash, providerProfile: 'ai3-practice-v1',
      modelProfileVersion: c.generation.preview.modelProfileVersion, pricingProfileVersion: c.generation.preview.pricingProfileVersion,
      sendNotAfter: c.generation.preview.sendNotAfter, status: 'succeeded',
      result: { text: JSON.stringify(text()), contentHash: require('../../services/ai1Contract').sha(JSON.stringify(text())) },
      usage: { inputTokens: 100, outputTokens: 100 }, sendClaimed: true, error: null,
      updatedAt: new Date(clock).toISOString(), ...overrides });
    beforeEach(() => {
      remote = null;
      client = { put: jest.fn(async c => { remote = outcome(c); return remote; }), get: jest.fn(async () => remote) };
      service = generation({ operationClient: client });
    });
    async function prepare() {
      const x = await ready(), ack = await send(x);
      return { ...x, commandId: ack.command.id };
    }
    const recoverRemote = (x, s = service, identity = parent) => s.recover({ identity, commandId: x.commandId,
      body: { schemaVersion: 'ai3-min-v1', operationId: x.body.operationId } });
    async function largeSource(character) {
      const s = { ...pkg.childSnapshot, questionText: character.repeat(4000), explanationText: character.repeat(7000) };
      // Seed a different immutable synthetic source; this is not a product edit path.
      await A.Package.collection.updateOne({ _id: pkg._id }, { $set: { childSnapshot: s, childSnapshotHash: C.hash(s) } });
      expect((await A.Package.findById(pkg._id).lean()).childSnapshot).toEqual(s);
    }
    test.each([['\u4e58', 'ai1'], ['\u4e58', 'ai3'], ['"', 'ai1'], ['"', 'ai3']])(
      'oversized source %s rejects before reserve; shared slot remains available to %s', async (character, nextProfile) => {
        await largeSource(character);
        const x = await ready(), before = await state(), beforePackage = await A.Package.findById(pkg._id).lean();
        await expect(send(x)).rejects.toMatchObject({ statusCode: 413, code: 'AI_INPUT_TOO_LARGE' });
        await expect(send(x)).rejects.toMatchObject({ statusCode: 413, code: 'AI_INPUT_TOO_LARGE' });
        expect(await state()).toBe(before);
        expect(await A.Package.findById(pkg._id).lean()).toEqual(beforePackage);
        expect(await Budget.Account.countDocuments()).toBe(0);
        expect(await Budget.Reservation.countDocuments()).toBe(0);
        expect(await Budget.Slot.countDocuments()).toBe(0);
        expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
        if (nextProfile === 'ai3') {
          await A.Package.collection.updateOne({ _id: pkg._id }, { $set: { childSnapshot: pkg.childSnapshot, childSnapshotHash: pkg.childSnapshotHash } });
          const { preview } = await service.generationPreview({ identity: parent, roundId: x.round.id });
          const legal = await send({ ...x, body: { ...x.body, generationInputHash: preview.generationInputHash } });
          expect((await service.claimGeneration({ identity: parent, commandId: legal.command.id })).claimed).toBe(true);
          expect(await Budget.Slot.findById('global').lean()).toMatchObject({ ownerProfile: 'ai3', jobId: new mongoose.Types.ObjectId(legal.command.id) });
        } else {
          const ai1 = require('../../services/ai1Service').createAi1Service({ now: () => clock, getProfile: () => profile,
            getLimits: () => limits, getRuntime: () => config, sourceReader });
          const one = await ai1.create({ identity: parent, body: { schemaVersion: 'ai1-min-v1', operationId: randomUUID(),
            childId: child.id, source: { type: 'task', id: id() }, input: { questionText: '124 * 23', answerText: null, parentContext: '' },
            chapter: pkg.childSnapshot.chapter, deidentifiedConfirmed: true } });
          const ack = await ai1.generate({ identity: parent, cycleId: one.cycle.id, body: { schemaVersion: 'ai1-min-v1', operationId: randomUUID(),
            expectedCycleStateVersion: one.cycle.stateVersion, generationInputHash: one.preview.generationInputHash,
            modelProfileVersion: one.preview.modelProfileVersion, pricingProfileVersion: one.preview.pricingProfileVersion,
            maxAuthorizedCostMicros: one.preview.reservedCeilingMicros, externalSendConfirmed: true } });
          expect((await ai1.claim({ identity: parent, jobId: ack.job.id })).claimed).toBe(true);
          expect(await Budget.Slot.findById('global').lean()).toMatchObject({ ownerProfile: 'ai1', jobId: new mongoose.Types.ObjectId(ack.job.id) });
        }
      });
    test.each(['current', 'expired', 'quote_changed'])(
      'legacy oversized RESERVED mapping with %s quote is rejected without refund or mutation', async condition => {
      const x = await prepare(); await largeSource('\u4e58');
      const preview = require('../../services/ai3GenerationPreview').buildGenerationPreview(
        await M.Round.findById(x.round.id).lean(), await A.Package.findById(pkg._id).lean(), profile, clock);
      const { requestHash: _oldHash, ...wire } = require('../../services/ai3Operation').buildRequest((await M.Command.findById(x.commandId).lean()).generation);
      const remoteRequestHash = C.hash({ ...wire, messages: preview.messages });
      await M.Command.collection.updateOne({ _id: new mongoose.Types.ObjectId(x.commandId) }, { $set: { 'generation.preview': preview,
        'generation.remoteRequestHash': remoteRequestHash } });
      if (condition === 'expired') clock = Date.parse(preview.sendNotAfter);
      if (condition === 'quote_changed') profile = { ...profile, pricingProfileVersion: 'changed-price' };
      const before = await state(), beforePackage = await A.Package.findById(pkg._id).lean();
      await expect(service.runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ statusCode: 413, code: 'AI_INPUT_TOO_LARGE' });
      expect(await state()).toBe(before);
      expect(await A.Package.findById(pkg._id).lean()).toEqual(beforePackage);
      expect(await Budget.Slot.countDocuments()).toBe(0);
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'reserved', reservedMicros: 184320 });
      expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
    });
    test('legacy oversized UNKNOWN recovery retains all state and original mapping without GET or replacement PUT', async () => {
      const x = await prepare();
      client.put.mockRejectedValue(Error('lost response'));
      await expect(service.runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
      const c = await M.Command.findById(x.commandId).lean();
      const { requestHash: _hash, ...wire } = require('../../services/ai3Operation').buildRequest(c.generation);
      const messages = [{ role: 'user', content: '\u4e58'.repeat(11000) }];
      const remoteRequestHash = C.hash({ ...wire, messages });
      await M.Command.collection.updateOne({ _id: c._id }, { $set: { 'generation.preview.messages': messages,
        'generation.remoteRequestHash': remoteRequestHash } });
      const before = await state(), beforePackage = await A.Package.findById(pkg._id).lean();
      await expect(recoverRemote(x, generation({ operationClient: client }))).rejects.toMatchObject({ statusCode: 413, code: 'AI_INPUT_TOO_LARGE' });
      expect(await state()).toBe(before);
      expect(await A.Package.findById(pkg._id).lean()).toEqual(beforePackage);
      expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).not.toHaveBeenCalled();
      expect((await M.Command.findById(c._id).lean()).generation).toMatchObject({ remoteOperationId: c.generation.remoteOperationId, remoteRequestHash });
      expect(await Budget.Reservation.findOne({ jobId: c._id }).lean()).toMatchObject({ state: 'reserved_unknown', reservedMicros: 184320 });
      expect(await Budget.Slot.findById('global').lean()).toMatchObject({ ownerProfile: 'ai3', jobId: c._id });
    });
    test('remote 413 then 404 stays unknown with original UUID, fee and slot; never retries PUT', async () => {
      const x = await prepare();
      client.put.mockRejectedValue(Object.assign(Error('413'), { code: 'AI_REMOTE_UNAVAILABLE', statusCode: 503 }));
      await expect(service.runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
      const original = await M.Command.findById(x.commandId).lean(), before = await state();
      client.get.mockRejectedValue(Object.assign(Error('404'), { code: 'AI_REMOTE_UNAVAILABLE', statusCode: 503 }));
      await expect(recoverRemote(x, generation({ operationClient: client }))).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
      expect(await state()).toBe(before);
      expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).toHaveBeenCalledTimes(1);
      expect(client.get.mock.calls[0][0].generation).toEqual(original.generation);
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'reserved_unknown', reservedMicros: 184320 });
      expect(await Budget.Slot.findById('global').lean()).toMatchObject({ jobId: original._id, ownerProfile: 'ai3' });
    });
    test('lost PUT response recovers only original mapping; one settlement and unpublished immutable candidate', async () => {
      const x = await prepare();
      client.put.mockImplementation(async c => { remote = outcome(c); throw Error('lost response'); });
      await expect(service.runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
      const pending = await M.Command.findById(x.commandId).lean();
      expect(pending.phase).toBe('UNKNOWN'); expect(pending.generation.remoteRequestHash).toMatch(/^[a-f0-9]{64}$/);
      const before = await state(); await service.getCommand({ identity: parent, commandId: x.commandId }); expect(await state()).toBe(before);
      config.enabled = false; profile = null;
      const restarted = generation({ operationClient: client });
      expect((await recoverRemote(x, restarted)).command.phase).toBe('SUCCEEDED');
      expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).toHaveBeenCalledTimes(1);
      expect(client.get.mock.calls[0][0].generation).toEqual(pending.generation);
      const r = await M.Round.findById(x.round.id).lean(), c = await M.Content.findById(r.currentContentId).lean();
      expect((await M.Command.findById(x.commandId).lean()).resultReference).toEqual({ roundId: x.round.id,
        stateVersion: r.stateVersion, contentId: String(c._id), contentVersion: c.version, contentHash: c.contentHash });
      expect(r).toMatchObject({ preparation: 'candidate', visibility: 'draft', activeCommandId: null });
      expect(c).toMatchObject({ origin: 'ai_generation', content: text(), createdBy: new mongoose.Types.ObjectId(parent.id) });
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'settled', settledMicros: 3600 });
      const settled = await state(); await recoverRemote(x, restarted); expect(await state()).toBe(settled);
      expect(client.get).toHaveBeenCalledTimes(1); expect(await M.Content.countDocuments()).toBe(1);
      await expect(service.getRound({ identity: child, roundId: x.round.id })).rejects.toMatchObject({ statusCode: 404 });
    });
    test('old accepted and remote not-found never resend or release an unknown fee', async () => {
      const x = await prepare();
      client.put.mockImplementation(async c => { remote = outcome(c, { status: 'accepted', result: null, usage: null, sendClaimed: false }); return remote; });
      expect((await service.runGeneration({ identity: parent, commandId: x.commandId })).command.phase).toBe('UNKNOWN');
      clock += 10 * 86400000; config.enabled = false;
      client.get.mockRejectedValue(Object.assign(Error('missing'), { code: 'AI_REMOTE_UNAVAILABLE', statusCode: 503 }));
      await expect(recoverRemote(x)).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
      expect(client.put).toHaveBeenCalledTimes(1);
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'reserved_unknown', reservedMicros: 184320 });
      expect((await Budget.Slot.findById('global').lean()).jobId.toString()).toBe(x.commandId);
    });
    test('persisted remote claim forbids later contradictory no-send refund after service reconstruction', async () => {
      const x = await prepare();
      client.put.mockImplementation(async c => { remote = outcome(c, { status: 'sending', result: null, usage: null }); return remote; });
      await service.runGeneration({ identity: parent, commandId: x.commandId });
      expect((await M.Command.findById(x.commandId).lean()).remoteClaimObserved).toBe(true);
      remote = { ...remote, status: 'failed_not_sent', sendClaimed: false, error: 'PREVIEW_STALE' };
      await expect(recoverRemote(x, generation({ operationClient: client }))).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
      expect(await Budget.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 184320, halted: true });
      expect(await M.Content.countDocuments()).toBe(0);
    });
    test('credible never-sent terminal releases exactly once', async () => {
      const x = await prepare();
      client.put.mockImplementation(async c => outcome(c, { status: 'failed_not_sent', result: null, usage: null, sendClaimed: false, error: 'PREVIEW_STALE' }));
      expect((await service.runGeneration({ identity: parent, commandId: x.commandId })).command.phase).toBe('FAILED');
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'released', settledMicros: 0 });
      const before = await state(); await recoverRemote(x); expect(await state()).toBe(before);
    });
    test.each(['not-json', JSON.stringify({ ...text(), extra: true }), JSON.stringify({ ...text(), exercises: text().exercises.slice(0, 1) }),
      '['.repeat(3000) + '0' + ']'.repeat(3000)])('charged invalid output fails without candidate: %#', async output => {
      const x = await prepare(); client.put.mockImplementation(async c => outcome(c, {
        result: { text: output, contentHash: require('../../services/ai1Contract').sha(output) } }));
      expect((await service.runGeneration({ identity: parent, commandId: x.commandId })).command.phase).toBe('FAILED');
      expect(await M.Content.countDocuments()).toBe(0);
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'settled', settledMicros: 3600 });
      expect((await M.Command.findById(x.commandId).lean()).remoteEvidence.result.text).toBe(output);
      expect(await Budget.Slot.findById('global').lean()).toMatchObject({ jobId: null });
    });
    test('ancestor withdrawal does not refund sent work and cannot publish returned candidate', async () => {
      const x = await prepare(); client.put.mockImplementation(async c => { remote = outcome(c); throw Error('lost'); });
      await expect(service.runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ statusCode: 503 });
      await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' } });
      await recoverRemote(x);
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'settled' });
      await expect(service.publicationPreview({ identity: parent, roundId: x.round.id })).rejects.toMatchObject({ statusCode: 409 });
    });
    test('recover is original actor only and denied after live family revocation; zero remote calls', async () => {
      const x = await prepare(); await service.claimGeneration({ identity: parent, commandId: x.commandId });
      await expect(recoverRemote(x, service, coparent)).rejects.toMatchObject({ statusCode: 404 });
      await expect(recoverRemote(x, service, outsider)).rejects.toMatchObject({ statusCode: 404 });
      await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
      await expect(recoverRemote(x)).rejects.toMatchObject({ statusCode: 403 });
      expect(client.get).not.toHaveBeenCalled(); expect(client.put).not.toHaveBeenCalled();
    });
    test('success without usage retains outstanding cost but releases only its send slot', async () => {
      const x = await prepare(); client.put.mockImplementation(async c => outcome(c, { usage: null }));
      await service.runGeneration({ identity: parent, commandId: x.commandId });
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: 'reserved_unknown', settledMicros: null });
      expect(await Budget.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 184320, settledMicros: 0 });
      expect(await Budget.Slot.findById('global').lean()).toMatchObject({ jobId: null });
      expect(await M.Content.countDocuments()).toBe(1);
    });
    test.each([null, { inputTokens: 100, outputTokens: 100 }])('failed_sent settles only known usage %j', async usage => {
      const x = await prepare(); client.put.mockImplementation(async c => outcome(c, { status: 'failed_sent', usage, result: null, error: 'PROVIDER_FAILED' }));
      expect((await service.runGeneration({ identity: parent, commandId: x.commandId })).command.phase).toBe('FAILED');
      expect(await Budget.Reservation.findOne({ jobId: x.commandId }).lean()).toMatchObject({ state: usage ? 'settled' : 'reserved_unknown', settledMicros: usage ? 3600 : null });
      expect(await Budget.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: usage ? 0 : 184320, settledMicros: usage ? 3600 : 0 });
      expect(await Budget.Slot.findById('global').lean()).toMatchObject({ jobId: null });
      expect(await M.Content.countDocuments()).toBe(0);
    });
    test('terminal transaction rollback retains durable remote claim, then concurrent original GET settles once', async () => {
      const x = await prepare();
      const original = M.Content.create.bind(M.Content);
      const fail = jest.spyOn(M.Content, 'create').mockImplementationOnce(async (...args) => { await original(...args); throw Error('rollback'); });
      try { await expect(service.runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ statusCode: 503 }); }
      finally { fail.mockRestore(); }
      expect(await M.Content.countDocuments()).toBe(0);
      expect(await Budget.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 184320, settledMicros: 0 });
      expect((await M.Command.findById(x.commandId).lean()).remoteClaimObserved).toBe(true);
      await Promise.all([recoverRemote(x), recoverRemote(x)]);
      expect(await M.Content.countDocuments()).toBe(1);
      expect(await Budget.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 0, settledMicros: 3600 });
      expect(client.put).toHaveBeenCalledTimes(1);
    });
    test('settlement commit acknowledgement lost is recovered locally without another remote query or charge', async () => {
      const x = await prepare(); let lost = false;
      const runner = async work => {
        const value = await runMongoTransaction({ mongooseInstance: mongoose, work });
        if (!lost && await M.Content.exists({ roundId: x.round.id })) { lost = true; throw Error('committed ack lost'); }
        return value;
      };
      await expect(generation({ operationClient: client, transactionRunner: runner }).runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ statusCode: 503 });
      expect(lost).toBe(true);
      expect((await recoverRemote(x)).command.phase).toBe('SUCCEEDED');
      expect(client.get).not.toHaveBeenCalled(); expect(client.put).toHaveBeenCalledTimes(1);
      expect(await M.Content.countDocuments()).toBe(1);
    });
    test.each(['remoteOperationId', 'requestHash', 'providerProfile'])('wrong response %s halts accounts and retains fees', async field => {
      const x = await prepare(); client.put.mockImplementation(async c => outcome(c, { [field]: 'wrong' }));
      await expect(service.runGeneration({ identity: parent, commandId: x.commandId })).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
      expect(await M.Content.countDocuments()).toBe(0);
      expect(await Budget.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 184320, halted: true });
    });
    test('missing persisted request digest blocks recovery before any remote call', async () => {
      const x = await prepare(); await service.claimGeneration({ identity: parent, commandId: x.commandId });
      await M.Command.collection.updateOne({ _id: new mongoose.Types.ObjectId(x.commandId) }, { $unset: { 'generation.remoteRequestHash': '' } });
      await expect(recoverRemote(x)).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
      expect(client.get).not.toHaveBeenCalled(); expect(client.put).not.toHaveBeenCalled();
    });
    test('late accepted query cannot downgrade settled terminal or halt budget', async () => {
      const x = await prepare(); await service.claimGeneration({ identity: parent, commandId: x.commandId });
      const c = await M.Command.findById(x.commandId).lean();
      let release, entered;
      const started = new Promise(resolve => { entered = resolve; });
      client.get.mockImplementationOnce(() => new Promise(resolve => {
        release = () => resolve(outcome(c, { status: 'accepted', result: null, usage: null, sendClaimed: false })); entered();
      })).mockResolvedValue(outcome(c));
      const late = recoverRemote(x); let failure;
      const joined = late.catch(e => { failure = e; });
      try {
        await started; await recoverRemote(x);
      } finally { release?.(); await joined; }
      expect(failure).toBeUndefined();
      expect((await M.Command.findById(x.commandId).lean()).phase).toBe('SUCCEEDED');
      expect(await Budget.Account.findById('experiment').lean()).toMatchObject({ halted: false, settledMicros: 3600, outstandingMicros: 0 });
      expect(await M.Content.countDocuments()).toBe(1);
    });
    test('generated content uses the same normalized CRLF length limits as manual revisions', async () => {
      const x = await prepare(), content = text(); content.instructions = 'a'.repeat(499) + '\r\n';
      for (const q of content.exercises) for (const key of ['questionText', 'answerForParent', 'rubricForParent']) q[key] = 'b'.repeat(999) + '\r\n';
      const raw = JSON.stringify(content);
      client.put.mockImplementation(async c => outcome(c, { result: { text: raw, contentHash: require('../../services/ai1Contract').sha(raw) } }));
      expect((await service.runGeneration({ identity: parent, commandId: x.commandId })).command.phase).toBe('SUCCEEDED');
      const saved = await M.Content.findOne({ roundId: x.round.id }).lean();
      expect(saved.content.instructions).toBe('a'.repeat(499) + '\n');
      for (const q of saved.content.exercises) for (const key of ['questionText', 'answerForParent', 'rubricForParent']) expect(q[key]).toBe('b'.repeat(999) + '\n');
      expect((await M.Command.findById(x.commandId).lean()).remoteEvidence.result.text).toBe(raw);
    });
  });
  test('preview is zero-write, complete and excludes private source fields; original accepted command survives lost response and off', async () => {
    const x = await ready(), before = await state();
    expect(x.preview.messages.map(m => m.role)).toEqual(['system', 'user']);
    expect(JSON.parse(x.preview.messages[1].content)).toEqual({ questionText: '124 * 23', explanationText: 'Synthetic approved explanation',
      chapter: pkg.childSnapshot.chapter, exerciseCount: 2 });
    expect(x.preview.requestOptions).toEqual({ model: 'synthetic-only', maxInputTokens: 8192, maxOutputTokens: 4096,
      thinking: 'disabled', tools: [], attemptLimit: 1 });
    expect(x.preview.reservedCeilingMicros).toBe(184320);
    await service.generationPreview({ identity: parent, roundId: x.round.id }); expect(await state()).toBe(before);
    const lost = generation({ transactionRunner: async work => { await runMongoTransaction({ mongooseInstance: mongoose, work }); throw Error('lost ack'); } });
    await expect(send(x, lost)).rejects.toMatchObject({ statusCode: 503 });
    const stored = await M.Command.findOne({ endpointOperation: 'ai3.generate' }).lean();
    expect(stored.generation.remoteOperationId).not.toBe(x.body.operationId);
    expect(stored.generation.preview).toEqual(x.preview);
    config.enabled = false; profile = null;
    const replay = await send(x, generation()); expect(replay.command.id).toBe(String(stored._id));
    const held = await state();
    expect((await generation().recover({ identity: parent, commandId: replay.command.id, body: { schemaVersion: 'ai3-min-v1', operationId: x.body.operationId } })).command.phase).toBe('RESERVED');
    expect(await state()).toBe(held); expect(await Budget.Reservation.countDocuments()).toBe(1);
    await expect(send({ ...x, body: { ...x.body, maxAuthorizedCostMicros: 1 } })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  test.each(['family', 'experiment'])('deterministic cold %s counter duplicate rolls back and retries identical IDs only', async which => {
    const x = await ready(), ids = [], createCommand = M.Command.create.bind(M.Command);
    const capture = jest.spyOn(M.Command, 'create').mockImplementation((rows, opts) => {
      ids.push([String(rows[0]._id), String(rows[0].generation.reservationId), rows[0].generation.remoteOperationId]);
      return createCommand(rows, opts);
    });
    const update = Budget.Account.findOneAndUpdate.bind(Budget.Account); let injected = false;
    const spy = jest.spyOn(Budget.Account, 'findOneAndUpdate').mockImplementation((q, ...args) => {
      if (!injected && q._id === (which === 'family' ? String(family._id) : 'experiment')) {
        injected = true; return { lean: async () => { await update(q, ...args).lean(); throw Object.assign(Error('cold collision'), { code: 11000, keyPattern: { _id: 1 }, keyValue: { _id: q._id } }); } };
      } return update(q, ...args);
    });
    try {
      const result = await send(x); expect(injected).toBe(true);
      expect(result.command.phase).toBe('RESERVED'); expect(await Budget.Reservation.countDocuments()).toBe(1);
      expect(await Budget.Account.findById(String(family._id))).toMatchObject({ outstandingMicros: 184320, settledMicros: 0 });
      expect(await Budget.Account.findById('experiment')).toMatchObject({ outstandingMicros: 184320, settledMicros: 0 });
      expect(ids).toHaveLength(2); expect(ids[0]).toEqual(ids[1]);
    } finally { spy.mockRestore(); capture.mockRestore(); }
  });
  test('cold slot duplicate retries same claim; restart, off and expiry cannot reclaim or refund dispatched command', async () => {
    const x = await ready(), result = await send(x), update = Budget.Slot.findOneAndUpdate.bind(Budget.Slot); let injected = false;
    const spy = jest.spyOn(Budget.Slot, 'findOneAndUpdate').mockImplementation((q, ...args) => {
      if (!injected) { injected = true; return { lean: async () => { await update(q, ...args).lean(); throw Object.assign(Error('cold slot'), {
        code: 11000, keyPattern: { _id: 1 }, keyValue: { _id: 'global' } }); } }; } return update(q, ...args);
    });
    try { expect((await service.claimGeneration({ identity: parent, commandId: result.command.id })).claimed).toBe(true); }
    finally { spy.mockRestore(); }
    expect(injected).toBe(true); const before = await state(); clock += 86400000; config.enabled = false;
    expect((await generation().claimGeneration({ identity: parent, commandId: result.command.id })).claimed).toBe(false);
    await generation().recover({ identity: parent, commandId: result.command.id, body: { ...cmd(), operationId: x.body.operationId } });
    expect(await state()).toBe(before); expect((await Budget.Account.findById('experiment')).outstandingMicros).toBe(184320);
  });
  test('expired unclaimed intent releases exactly once and retains terminal original command', async () => {
    const x = await ready(), result = await send(x); clock = Date.parse(x.preview.sendNotAfter);
    const terminal = await service.claimGeneration({ identity: parent, commandId: result.command.id });
    expect(terminal).toMatchObject({ claimed: false, command: { phase: 'FAILED' } });
    expect(await Budget.Account.findById('experiment')).toMatchObject({ outstandingMicros: 0, settledMicros: 0 });
    const before = await state(); await service.claimGeneration({ identity: parent, commandId: result.command.id });
    expect(await state()).toBe(before);
    const r = await M.Round.findById(x.round.id).lean();
    await expect(send({ ...x, body: { ...x.body, ...cmd(), expectedRoundVersion: r.stateVersion } })).rejects.toMatchObject({ statusCode: 409 });
  });
  test('same UUID co-parent cannot recover original mapping; concurrent new command has one winner', async () => {
    const x = await ready();
    const outcomes = await Promise.allSettled([send(x), send(x, service, coparent)]);
    expect(outcomes.filter(v => v.status === 'fulfilled')).toHaveLength(1);
    const winner = outcomes.findIndex(v => v.status === 'fulfilled'), actor = [parent, coparent][winner], other = [coparent, parent][winner];
    const c = outcomes[winner].value.command; expect(await Budget.Reservation.countDocuments()).toBe(1);
    await expect(service.claimGeneration({ identity: other, commandId: c.id })).rejects.toMatchObject({ statusCode: 404 });
    const before = await state(); await Family.updateOne({ _id: family._id }, { $set: { memberParentIds: [], ownerParentId: id() } });
    await expect(service.recover({ identity: actor, commandId: c.id, body: { ...cmd(), operationId: x.body.operationId } })).rejects.toMatchObject({ statusCode: 403 });
    expect(await state()).toBe(before);
  });
  test('changed quote, withdrawn ancestor and manual edits cannot bypass final generation checks', async () => {
    const x = await ready(); profile = { ...profile, pricingProfileVersion: 'new-price' }; const before = await state();
    await expect(send(x)).rejects.toMatchObject({ statusCode: 409 }); expect(await state()).toBe(before);
    profile.pricingProfileVersion = 'synthetic-price-v1'; const accepted = await send(x);
    await expect(service.reviseContent({ identity: parent, roundId: x.round.id, body: revision(accepted.round) })).rejects.toMatchObject({ code: 'AI3_OPERATION_UNRESOLVED' });
    await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' } });
    const result = await service.claimGeneration({ identity: parent, commandId: accepted.command.id });
    expect(result.command.phase).toBe('FAILED'); expect(await Budget.Slot.countDocuments()).toBe(0);
    expect((await Budget.Account.findById('experiment')).outstandingMicros).toBe(0);
  });
  test('deadline crossed during slot acquisition cannot persist a send authority', async () => {
    const x = await ready(), result = await send(x), before = await state();
    const update = Budget.Slot.findOneAndUpdate.bind(Budget.Slot);
    const spy = jest.spyOn(Budget.Slot, 'findOneAndUpdate').mockImplementation((...args) => ({ lean: async () => {
      const slot = await update(...args).lean(); clock = Date.parse(x.preview.sendNotAfter); return slot;
    } }));
    try { await expect(service.claimGeneration({ identity: parent, commandId: result.command.id })).rejects.toMatchObject({ code: 'AI_PREVIEW_STALE' }); }
    finally { spy.mockRestore(); }
    expect(await state()).toBe(before);
  });
  test.each(['off', 'quote'])('final claim rejects %s changed during slot write and rolls back everything', async kind => {
    const x = await ready(), made = await send(x), before = await state();
    const update = Budget.Slot.updateOne.bind(Budget.Slot);
    const spy = jest.spyOn(Budget.Slot, 'updateOne').mockImplementation(async (...args) => {
      const result = await update(...args);
      if (kind === 'off') config.enabled = false;
      else profile = { ...profile, pricingProfileVersion: 'changed-after-slot' };
      return result;
    });
    try { await expect(service.claimGeneration({ identity: parent, commandId: made.command.id })).rejects.toMatchObject({
      code: kind === 'off' ? 'AI3_NOT_ENABLED' : 'AI_PREVIEW_STALE' }); }
    finally { spy.mockRestore(); }
    expect(await state()).toBe(before);
  });
  test.each(['generate', 'claim'])('ancestor withdrawal after %s snapshot wins over stale transaction', async step => {
    const x = await ready(), accepted = step === 'claim' ? await send(x) : null;
    const update = A.Package.updateOne.bind(A.Package); let injected = false;
    const spy = jest.spyOn(A.Package, 'updateOne').mockImplementation(async (query, change, options) => {
      if (options?.session && !injected) {
        injected = true; await update({ _id: pkg._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
      }
      return update(query, change, options);
    });
    try {
      if (step === 'generate') await expect(send(x)).rejects.toMatchObject({ code: 'AI3_SOURCE_NOT_APPROVED' });
      else expect((await service.claimGeneration({ identity: parent, commandId: accepted.command.id })).command.phase).toBe('FAILED');
    } finally { spy.mockRestore(); }
    expect(injected).toBe(true); expect(await Budget.Slot.countDocuments()).toBe(0);
    expect(await Budget.Reservation.countDocuments({ state: { $in: ['reserved', 'reserved_unknown'] } })).toBe(0);
    expect((await Budget.Account.findById('experiment'))?.outstandingMicros || 0).toBe(0);
  });
  test('claim commit acknowledgement loss never grants a second send authority after reconstruction', async () => {
    const x = await ready(), made = await send(x);
    const lost = generation({ transactionRunner: async work => { await runMongoTransaction({ mongooseInstance: mongoose, work }); throw Error('lost claim ack'); } });
    await expect(lost.claimGeneration({ identity: parent, commandId: made.command.id })).rejects.toMatchObject({ statusCode: 503 });
    const held = await state();
    expect((await generation().claimGeneration({ identity: parent, commandId: made.command.id })).claimed).toBe(false);
    expect(await state()).toBe(held);
  });
  test('unknown duplicate errors and exhausted cold retries do not leave charges or change mapping', async () => {
    const x = await ready(), before = await state();
    for (const key of ['unrecognized', 'experiment']) {
      let tries = 0;
      const injected = generation({ transactionRunner: work => { tries++; return runMongoTransaction({ mongooseInstance: mongoose,
        work: async s => { await work(s); throw Object.assign(Error('duplicate'), { code: 11000, keyPattern: { _id: 1 }, keyValue: { _id: key } }); } }); } });
      await expect(send(x, injected)).rejects.toMatchObject({ code: 'AI3_OPERATION_UNRESOLVED' });
      expect(tries).toBe(key === 'experiment' ? 2 : 1); expect(await state()).toBe(before);
    }
  });
  test.each(['child', 'sibling', 'outsider'])('generation rejects %s before exposing messages or reserving fees', async who => {
    const x = await ready(), before = await state(), identity = { child, sibling, outsider }[who];
    await expect(service.generationPreview({ identity, roundId: x.round.id })).rejects.toMatchObject({ statusCode: who === 'outsider' ? 404 : 403 });
    await expect(send(x, service, identity)).rejects.toMatchObject({ statusCode: who === 'outsider' ? 404 : 403 });
    expect(await state()).toBe(before);
  });
});

test('manual revision -> publication -> child view, immutable history and exact original replay', async () => {
  const first = await candidate(); const revised = revision(first.round); revised.content.exercises[0].questionText = '132 * 25';
  const next = await service.reviseContent({ identity: coparent, roundId: first.round.id, body: revised });
  const body = await publication(next.round);
  const published = await service.publish({ identity: parent, roundId: next.round.id, body });
  const read = await service.getRound({ identity: child, roundId: next.round.id });
  expect(read.round.childSnapshot.exercises[0].questionText).toBe('132 * 25');
  expect(JSON.stringify(read)).not.toMatch(/SECRET_|answerForParent|rubricForParent|contentHash|createdBy/);
  expect(await M.Content.countDocuments()).toBe(2);
  expect((await M.Content.findOne({ version: 1 }).lean()).content.exercises[0].questionText).toBe('132 * 24');
  const withdrawn = await service.withdraw({ identity: coparent, roundId: next.round.id,
    body: { ...cmd(), expectedRoundVersion: published.round.stateVersion, reason: 'Stop' } });
  expect(withdrawn.round.visibility).toBe('withdrawn');
  const replay = await service.publish({ identity: parent, roundId: next.round.id, body });
  expect(replay.command).toEqual(published.command);
  expect(replay.command.resultReference.contentId).toBe(next.round.currentContentId);
  await expect(service.getRound({ identity: child, roundId: next.round.id })).rejects.toMatchObject({ statusCode: 404 });
});
test.each(['sourceAttemptId', 'sourceReviewHash', 'expectedSourcePackageVersion'])('stale source %s creates nothing', async field => {
  const b = bodyCreate(); b[field] = field === 'expectedSourcePackageVersion' ? 2 : field === 'sourceAttemptId' ? id() : 'c'.repeat(64);
  await expect(service.create({ identity: parent, body: b })).rejects.toMatchObject({ statusCode: 409 });
  expect(await counts()).toEqual([0, 0, 0]); expect((await A.Package.findById(pkg._id)).stateVersion).toBe(3);
});
test('current membership and PIN override cached identity, including old command replay', async () => {
  const b = bodyCreate(); const made = await service.create({ identity: coparent, body: b });
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  await expect(service.create({ identity: coparent, body: b })).rejects.toMatchObject({ statusCode: 403 });
  await expect(service.getRound({ identity: outsider, roundId: made.round.id })).rejects.toMatchObject({ statusCode: 404 });
  await expect(service.getRound({ identity: sibling, roundId: made.round.id })).rejects.toMatchObject({ statusCode: 404 });
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  await expect(service.getRound({ identity: child, roundId: made.round.id })).rejects.toMatchObject({ code: 'STALE_CHILD_TOKEN' });
});
test('original actor commands discover/recover without writes; same UUID other actor is not a replay', async () => {
  const b = bodyCreate(), made = await service.create({ identity: parent, body: b });
  expect((await service.listCommands({ identity: parent, childId: child.id })).items).toHaveLength(1);
  const before = await counts();
  const restored = await factory().recover({ identity: parent, commandId: made.command.id, body: { schemaVersion: b.schemaVersion, operationId: b.operationId } });
  expect(restored.command).toEqual(made.command); expect(await counts()).toEqual(before);
  await expect(service.recover({ identity: coparent, commandId: made.command.id, body: { ...cmd(), operationId: b.operationId } })).rejects.toMatchObject({ statusCode: 404 });
  await expect(service.create({ identity: coparent, body: b })).rejects.toMatchObject({ statusCode: 409 });
  await expect(service.create({ identity: parent, body: { ...b, exerciseCount: 3 } })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
test('reject requires a new candidate before publish; stale preview cannot approve a replacement', async () => {
  const c = await candidate(), old = await publication(c.round);
  const rejected = await service.rejectContent({ identity: parent, roundId: c.round.id, body: { ...cmd(),
    expectedRoundVersion: c.round.stateVersion, contentId: c.round.currentContentId, contentVersion: 1,
    contentHash: c.round.currentContentHash, reason: 'Incorrect' } });
  await expect(service.publish({ identity: parent, roundId: c.round.id, body: { ...old, expectedRoundVersion: rejected.round.stateVersion } })).rejects.toMatchObject({ statusCode: 409 });
  const next = await service.reviseContent({ identity: parent, roundId: c.round.id, body: revision(rejected.round) });
  await expect(service.publish({ identity: parent, roundId: c.round.id, body: old })).rejects.toMatchObject({ statusCode: 409 });
  expect(next.round.currentContentVersion).toBe(2);
});
test('two co-managers with same UUID have one publication and first actor audit', async () => {
  const c = await candidate(), body = await publication(c.round);
  const outcomes = await Promise.allSettled([parent, coparent].map(identity => service.publish({ identity, roundId: c.round.id, body })));
  expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find(x => x.status === 'rejected').reason.statusCode).toBe(409);
  const winner = outcomes.findIndex(x => x.status === 'fulfilled');
  expect((await M.Round.findById(c.round.id)).publishedBy.toString()).toBe([parent, coparent][winner].id);
  expect(await M.Command.countDocuments({ endpointOperation: 'ai3.publish' })).toBe(1);
});
test('ancestor withdrawal after source read is caught by final transaction, not published', async () => {
  const c = await candidate(), body = await publication(c.round);
  sourceReader.require.mockImplementationOnce(async q => {
    await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
    return { id: q.sourceTaskId, familyId: String(family._id), childId: child.id, subject: 'math' };
  });
  await expect(service.publish({ identity: parent, roundId: c.round.id, body })).rejects.toMatchObject({ statusCode: 409 });
  expect((await M.Round.findById(c.round.id)).visibility).toBe('draft');
  expect(await M.Command.countDocuments({ endpointOperation: 'ai3.publish' })).toBe(0);
});
test('transaction rollback is atomic; unknown committed result replays without new records', async () => {
  const b = bodyCreate();
  const rollback = factory({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose,
    work: async session => { await work(session); throw new Error('Synthetic abort'); } }) });
  await expect(rollback.create({ identity: parent, body: b })).rejects.toMatchObject({ statusCode: 503 });
  expect(await counts()).toEqual([0, 0, 0]); expect((await A.Package.findById(pkg._id)).stateVersion).toBe(3);
  const unknown = factory({ transactionRunner: async work => { await runMongoTransaction({ mongooseInstance: mongoose, work }); throw new Error('Lost commit response'); } });
  await expect(unknown.create({ identity: parent, body: b })).rejects.toMatchObject({ statusCode: 503 });
  const recovered = await service.create({ identity: parent, body: b });
  expect(recovered.command.phase).toBe('SUCCEEDED'); expect(await counts()).toEqual([1, 0, 1]);
});
test('default off and discontinuity deny writes; off keeps withdrawal and terminal recovery', async () => {
  const b = bodyCreate();
  await expect(createAi3Service().create({ identity: parent, body: b })).rejects.toMatchObject({ statusCode: 503 });
  const c = await candidate(), body = await publication(c.round), p = await service.publish({ identity: parent, roundId: c.round.id, body });
  config.enabled = false;
  expect((await service.getRound({ identity: child, roundId: c.round.id })).round.visibility).toBe('published');
  const w = await service.withdraw({ identity: parent, roundId: c.round.id, body: { ...cmd(), expectedRoundVersion: p.round.stateVersion, reason: 'Off' } });
  expect(w.round.visibility).toBe('withdrawn');
  config.continuousStore = false;
  await expect(service.recover({ identity: parent, commandId: p.command.id, body: { ...cmd(), operationId: body.operationId } })).rejects.toMatchObject({ statusCode: 503 });
});
test('cancelled round cannot create content and does not block a new round', async () => {
  const made = await create();
  await service.cancel({ identity: parent, roundId: made.round.id, body: { ...cmd(), expectedRoundVersion: 1, reason: 'Cancel' } });
  await expect(service.reviseContent({ identity: parent, roundId: made.round.id, body: { ...revision(made.round), expectedRoundVersion: 2 } })).rejects.toMatchObject({ statusCode: 409 });
  pkg = await A.Package.findById(pkg._id); const b = bodyCreate(); b.expectedSourcePackageVersion = pkg.stateVersion;
  expect((await service.create({ identity: parent, body: b })).round.id).not.toBe(made.round.id);
});
test('source unavailable is not missing; source and chapter scope are enforced before reservation', async () => {
  sourceReader.require.mockRejectedValueOnce(new Error('offline'));
  await expect(create()).rejects.toMatchObject({ statusCode: 503 });
  sourceReader.require.mockResolvedValueOnce({ id: pkg.source.id, familyId: String(family._id), childId: sibling.id, subject: 'math' });
  await expect(create()).rejects.toMatchObject({ statusCode: 404 });
  // Corrupt persisted prerequisite deliberately; normal Mongoose writes protect this immutable snapshot.
  await A.Package.collection.updateOne({ _id: pkg._id }, { $set: { 'childSnapshot.chapter.grade': 5 } });
  expect((await A.Package.findById(pkg._id)).childSnapshot.chapter.grade).toBe(5);
  await expect(create()).rejects.toMatchObject({ statusCode: 409 });
  expect(await counts()).toEqual([0, 0, 0]);
});
test('mistake source with no knowledge point remains valid; nonmatching association is rejected', async () => {
  const source = { ...pkg.source, type: 'mistake' };
  await A.Package.collection.updateOne({ _id: pkg._id }, { $set: { source } });
  const b = bodyCreate(); b.knowledgePointId = id();
  await expect(service.create({ identity: parent, body: b })).rejects.toMatchObject({ statusCode: 409 });
  expect(await counts()).toEqual([0, 0, 0]);
  const made = await create(); expect(made.round.source.type).toBe('mistake'); expect(made.round.knowledgePointId).toBeNull();
});
test('explicit knowledge point must belong to this child and math, not a trusted client ID', async () => {
  const b = bodyCreate(); b.knowledgePointId = id();
  const point = { id: b.knowledgePointId, familyId: String(family._id), childId: sibling.id, dimension: 'academic', subject: 'math' };
  const s = factory({ knowledgePointReader: { read: async () => point } });
  await expect(s.create({ identity: parent, body: b })).rejects.toMatchObject({ statusCode: 404 });
  point.childId = child.id; point.subject = 'english';
  await expect(s.create({ identity: parent, body: b })).rejects.toMatchObject({ statusCode: 409 });
  point.subject = 'math'; expect((await s.create({ identity: parent, body: b })).round.knowledgePointId).toBe(b.knowledgePointId);
});
test('pending intent prevents manual replacement/cancel and source withdrawal hides child content', async () => {
  const c = await candidate();
  await M.Round.updateOne({ _id: c.round.id }, { $set: { preparation: 'generating', activeCommandId: id() } });
  await expect(service.reviseContent({ identity: parent, roundId: c.round.id, body: revision(c.round) })).rejects.toMatchObject({ code: 'AI3_OPERATION_UNRESOLVED' });
  await expect(service.cancel({ identity: parent, roundId: c.round.id, body: { ...cmd(), expectedRoundVersion: c.round.stateVersion, reason: 'Cancel' } })).rejects.toMatchObject({ statusCode: 409 });
  await M.Round.updateOne({ _id: c.round.id }, { $set: { preparation: 'candidate', activeCommandId: null } });
  await service.publish({ identity: parent, roundId: c.round.id, body: await publication(c.round) });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
  await expect(service.getRound({ identity: child, roundId: c.round.id })).rejects.toMatchObject({ statusCode: 404 });
  expect((await service.getRound({ identity: parent, roundId: c.round.id })).round.content.exercises).toHaveLength(2);
});
test('read-only preview and child detail do not change rounds, commands or ancestor versions', async () => {
  const c = await candidate();
  const snapshot = async () => JSON.stringify(await Promise.all([M.Round, M.Content, M.Command, A.Package, A.Attempt].map(m => m.find().sort({ _id: 1 }).lean())));
  const before = await snapshot(); await publication(c.round); await service.getRound({ identity: parent, roundId: c.round.id });
  expect(await snapshot()).toBe(before);
  await service.publish({ identity: parent, roundId: c.round.id, body: await publication(c.round) });
  const published = await snapshot(); await service.getRound({ identity: child, roundId: c.round.id });
  expect(await snapshot()).toBe(published);
});
test('missing unique index and nontransaction session fail closed without records', async () => {
  await M.Round.collection.dropIndex('ai3_active_round');
  try { await expect(create()).rejects.toMatchObject({ statusCode: 503 }); expect(await counts()).toEqual([0, 0, 0]); }
  finally { await M.Round.createIndexes(); }
  await expect(factory({ transactionRunner: work => work({ inTransaction: () => false }) }).create({ identity: parent, body: bodyCreate() }))
    .rejects.toMatchObject({ statusCode: 503 });
  expect(await counts()).toEqual([0, 0, 0]);
});
test('missing collection reports sanitized readiness failure, with no business writes', async () => {
  await M.Content.collection.drop();
  try {
    await expect(create()).rejects.toMatchObject({ statusCode: 503, code: 'AI3_NOT_READY', message: 'AI3_NOT_READY', details: [] });
    expect(await counts()).toEqual([0, 0, 0]); expect((await A.Package.findById(pkg._id)).stateVersion).toBe(3);
  } finally { await M.Content.createCollection(); await M.Content.createIndexes(); }
});
test('failed hello capability reports sanitized readiness failure and zero writes', async () => {
  const spy = jest.spyOn(mongoose.connection.db, 'admin').mockReturnValue({ command: async () => ({ isWritablePrimary: true }) });
  try {
    await expect(create()).rejects.toMatchObject({ statusCode: 503, code: 'AI3_NOT_READY', message: 'AI3_NOT_READY', details: [] });
    expect(await counts()).toEqual([0, 0, 0]); expect((await A.Package.findById(pkg._id)).stateVersion).toBe(3);
  } finally { spy.mockRestore(); }
});
test.each(['create', 'publish'])('ancestor withdrawal after transaction snapshot read defeats %s via conditional write', async action => {
  const c = action === 'publish' ? await candidate() : null;
  const b = action === 'publish' ? await publication(c.round) : bodyCreate();
  const before = await counts(); let resume, entered, timer, paused = false;
  const release = new Promise(resolve => { resume = resolve; });
  const arrived = new Promise((resolve, reject) => { entered = resolve; timer = setTimeout(() => reject(new Error('Barrier not reached')), 3000); });
  const original = A.Attempt.findOne.bind(A.Attempt);
  const spy = jest.spyOn(A.Attempt, 'findOne').mockImplementation((...args) => {
    const query = original(...args), lean = query.lean.bind(query);
    query.lean = async (...options) => {
      const row = await lean(...options);
      if (query.getOptions().session && !paused) { paused = true; entered(); await release; }
      return row;
    };
    return query;
  });
  let pending;
  try {
    pending = (action === 'create' ? service.create({ identity: parent, body: b })
      : service.publish({ identity: parent, roundId: c.round.id, body: b })).then(value => ({ value }), error => ({ error }));
    await arrived;
    await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
    resume(); const result = await pending;
    expect(result.error).toMatchObject({ statusCode: 409 }); expect(result.value).toBeUndefined();
    expect(await counts()).toEqual(before);
    if (c) expect((await M.Round.findById(c.round.id)).visibility).toBe('draft');
  } finally { clearTimeout(timer); resume(); if (pending) await pending; spy.mockRestore(); }
});
test('exact child DTO and corrupted projection rejection protect private content', async () => {
  const c = await candidate(), b = await publication(c.round);
  const record = await M.Content.findById(c.round.currentContentId).lean();
  await M.Content.collection.updateOne({ _id: record._id }, { $set: { 'childSnapshot.instructions': 'SECRET_ANSWER' } });
  await expect(service.publicationPreview({ identity: parent, roundId: c.round.id })).rejects.toMatchObject({ statusCode: 503 });
  await expect(service.publish({ identity: parent, roundId: c.round.id, body: b })).rejects.toMatchObject({ statusCode: 503 });
  expect(await M.Command.countDocuments({ endpointOperation: 'ai3.publish' })).toBe(0);
  await M.Content.collection.updateOne({ _id: record._id }, { $set: { childSnapshot: record.childSnapshot } });
  await service.publish({ identity: parent, roundId: c.round.id, body: b });
  const result = await service.getRound({ identity: child, roundId: c.round.id });
  expect(Object.keys(result)).toEqual(['round']);
  expect(Object.keys(result.round).sort()).toEqual(['id', 'sourcePackageId', 'source', 'chapter', 'exerciseCount', 'visibility', 'learningState',
    'stateVersion', 'publishedAt', 'contentId', 'contentVersion', 'childSnapshot', 'childSnapshotHash', 'currentAttemptId', 'currentAttemptVersion',
    'pending', 'reviewReminderDate', 'sourceAvailability'].sort());
  expect(Object.keys(result.round.source).sort()).toEqual(['id', 'type']);
  expect(Object.keys(result.round.childSnapshot).sort()).toEqual(['exercises', 'instructions']);
  for (const q of result.round.childSnapshot.exercises) expect(Object.keys(q).sort()).toEqual(['exerciseId', 'questionText']);
  await M.Content.collection.updateOne({ _id: record._id }, { $set: { 'childSnapshot.instructions': 'SECRET_ANSWER' } });
  await expect(service.getRound({ identity: child, roundId: c.round.id })).rejects.toMatchObject({ statusCode: 503 });
});

const { createAi2Runtime } = require('../services/ai2Runtime');
const { createMediaService } = require('../services/mediaService');
const { createMediaCapabilityService } = require('../services/mediaCapability');
const { createAi2MediaInspectRouter } = require('../routes/ai2MediaInspect');

const id = n => n.toString(16).padStart(24, '0');
const token = 'synthetic-continuity-service-token-32chars';
const query = value => ({ select() { return this; }, limit() { return this; }, lean: async () => value });
const barrier = () => {
  let enter, release;
  const arrived = new Promise(resolve => { enter = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  return { arrived, release, pause: async value => { enter(); await held; return value; } };
};
const settle = promise => promise.then(value => ({ value }), error => ({ error }));
const reach = (gate, outcome) => Promise.race([gate.arrived, outcome.then(() => {
  throw Error('Operation settled before reaching the synthetic await boundary');
})]);
const isolate = env => { env.AI2_MODE = 'off'; env.AI2_STORE_CONTINUOUS = 'false'; };
const expectDenied = result => {
  expect(result.error).toMatchObject({ code: 'AI2_NOT_READY', statusCode: 503 });
  expect(result.value).toBeUndefined();
};

// Real runtime, media service and capabilities; only database/storage boundaries are synthetic.
const fixture = ({ role = 'parent', deleted = false, purpose = 'ai2_correction', injectGuard = true } = {}) => {
  const env = { AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true', COMPLETION_PROTOCOL_MODE: 'enabled',
    HOMEWORK_SERVICE_URL: 'http://127.0.0.1:1', MEDIA_REFERENCE_SERVICE_TOKEN: token };
  const runtime = createAi2Runtime({ env, completionProtocol: true, isReady: () => true });
  const bytes = Buffer.from('synthetic-image-bytes');
  const asset = { _id: id(1), familyId: id(2), childId: id(3), uploadedBy: id(3), purpose,
    status: deleted ? 'deleted' : 'active', mimeType: 'image/png', sizeBytes: bytes.length,
    storageKey: '11111111-1111-4111-8111-111111111111', displayName: 'synthetic',
    ...(deleted ? { privacyDeletionRecorded: true, deletedAt: new Date('2026-01-01T00:00:00Z') } : {}) };
  const identity = role === 'student'
    ? { id: id(3), role, familyId: id(2), childId: id(3), tokenVersion: 0 }
    : { id: id(4), role };
  const tombstone = deleted ? { ...asset, mediaId: asset._id } : null;
  const boundaries = {
    read: async () => bytes,
    tombstoneExists: async () => false,
    receiptExists: async () => true
  };
  const capabilities = createMediaCapabilityService({ secret: 'synthetic-continuity-capability-secret-32chars' });
  const service = createMediaService({
    MediaAssetModel: { create() {}, findById: () => query(asset), findOne: () => query(asset) },
    MediaReferenceModel: { updateMany() {}, find: () => query([]), exists: async () => true },
    FamilyModel: { findOne: () => query({ _id: id(2) }) },
    UserModel: { exists: async () => true, findOne: () => query({ _id: identity.id, role,
      familyId: id(2), childProfile: { tokenVersion: 0 } }) },
    MediaDeletionTombstoneModel: { exists: () => boundaries.tombstoneExists(), findOne: () => query(tombstone) },
    MediaDeletionReceiptModel: { exists: () => boundaries.receiptExists() },
    capabilityService: capabilities,
    mediaStore: { writeCanonical() {}, remove() {}, read: () => boundaries.read() },
    transactionRunner: async work => work(null),
    getAi2Mode: runtime.getAi2Mode,
    ...(injectGuard ? { assertAi2Continuous: runtime.assertAi2Continuous } : {})
  });
  const contentInput = (authenticated = true) => {
    const access = capabilities.issue(asset._id, authenticated ? { requiresAuthorization: true } : {});
    const url = new URL(access.url, 'http://127.0.0.1');
    return { identity, mediaId: asset._id, path: url.pathname, ...Object.fromEntries(url.searchParams) };
  };
  const inspectInput = { familyId: id(2), childId: id(3), identity, mediaIds: [id(1)], bindings: [{
    mediaId: id(1), resourceType: 'ai2_attempt', resourceId: id(5), field: 'correctionMediaIds',
    bindingOperationId: '11111111-1111-4111-8111-111111111111'
  }] };
  return { env, runtime, service, capabilities, boundaries, bytes, asset, identity, contentInput, inspectInput };
};

test('parent and unbound child content cannot return bytes after isolation during storage await', async () => {
  for (const role of ['parent', 'student']) {
    const f = fixture({ role }), gate = barrier();
    f.boundaries.read = () => gate.pause(f.bytes);
    const outcome = settle(f.service.readAuthenticatedContent(f.contentInput()));
    try {
      await reach(gate, outcome);
      isolate(f.env);
      expect(() => f.runtime.assertAi2Continuous()).toThrow('AI2_NOT_READY');
    } finally { gate.release(); }
    expectDenied(await outcome);
  }
});

test('issueAccess cannot mint a capability after isolation during authorization await', async () => {
  const f = fixture(), gate = barrier();
  f.boundaries.tombstoneExists = () => gate.pause(false);
  const issue = jest.spyOn(f.capabilities, 'issue');
  const outcome = settle(f.service.issueAccess({ identity: f.identity, mediaId: f.asset._id }));
  try { await reach(gate, outcome); isolate(f.env); } finally { gate.release(); }
  expectDenied(await outcome);
  expect(issue).not.toHaveBeenCalled();
});

test('inspect cannot return available or deleted metadata after isolation during its final dependency await', async () => {
  for (const deleted of [false, true]) {
    const f = fixture({ deleted }), gate = barrier();
    if (deleted) f.boundaries.receiptExists = () => gate.pause(true);
    else f.boundaries.read = () => gate.pause(f.bytes);
    const outcome = settle(f.service.inspect(f.inspectInput));
    try { await reach(gate, outcome); isolate(f.env); } finally { gate.release(); }
    expectDenied(await outcome);
  }
});

test('metadata route rechecks continuity after inspect settles and before the success envelope', async () => {
  const f = fixture(), gate = barrier();
  const items = [{ mediaId: f.asset._id, mimeType: 'image/png', sizeBytes: f.bytes.length, status: 'available' }];
  const router = createAi2MediaInspectRouter({ serviceToken: token,
    assertAi2Continuous: f.runtime.assertAi2Continuous, mediaService: { inspect: () => gate.pause(items) } });
  // Exercise the actual endpoint callback without a socket; credential/parser cases live in ai2MediaInspect.test.js.
  const endpoint = router.stack.find(layer => layer.route?.path === '/inspect').route.stack.slice(-1)[0].handle;
  const outcome = new Promise(resolve => {
    const res = { set: () => res, json: value => resolve({ value }) };
    endpoint({ body: f.inspectInput }, res, error => resolve({ error }));
  });
  try { await reach(gate, outcome); isolate(f.env); } finally { gate.release(); }
  expectDenied(await outcome);
});

test('standalone default no-op remains compatible and continuous off preserves AI2 reads', async () => {
  for (const injectGuard of [false, true]) {
    const f = fixture({ injectGuard });
    f.env.AI2_MODE = 'off';
    if (!injectGuard) f.env.AI2_STORE_CONTINUOUS = 'false';
    expect((await f.service.readAuthenticatedContent(f.contentInput())).bytes).toEqual(f.bytes);
    expect((await f.service.issueAccess({ identity: f.identity, mediaId: f.asset._id })).access.requiresAuthorization).toBe(true);
    expect(await f.service.inspect(f.inspectInput)).toEqual([
      { mediaId: f.asset._id, mimeType: 'image/png', sizeBytes: f.bytes.length, status: 'available' }
    ]);
  }
});

test('legacy non-AI2 content remains independent of AI2 continuity', async () => {
  const f = fixture({ purpose: 'growth_evidence' });
  isolate(f.env);
  expect((await f.service.readContent(f.contentInput(false))).bytes).toEqual(f.bytes);
});

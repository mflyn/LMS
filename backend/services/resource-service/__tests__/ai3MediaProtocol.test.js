const { randomUUID } = require('crypto');
const protocol = require('../../../common/services/completionMediaProtocol');
const { createCompletionMediaReferenceClient } = require('../../../common/services/completionMediaReferenceClient');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const id = 'a'.repeat(24);

test.each(['ai3rounds', 'ai3contents', 'ai3attempts', 'ai3commands', 'mediaassets', 'mediareferences'])(
  'legacy activation rejects retained AI3 %s without mounting a route', async name => {
    const { assertLegacyCompletionState } = require('../../../common/services/completionActivation');
    const connection = { db: { collection: collection => ({ findOne: async query => {
      if (collection !== name) return null;
      if (name.startsWith('ai3') || query.purpose === 'ai3_practice'
        || query.field?.$in?.includes('practiceMediaIds')) return { _id: id };
      return null;
    } }) } };
    await expect(assertLegacyCompletionState({ connection, service: name.startsWith('ai3') ? 'homework' : 'resource' }))
      .rejects.toMatchObject({ code: 'COMPLETION_LEGACY_UNSAFE' });
  });

test('AI3 is a closed distinct triple; legacy hashes are unchanged', () => {
  expect(protocol.purposeFor('ai3_attempt')).toBe('ai3_practice');
  expect(protocol.fieldFor('ai3_attempt')).toBe('practiceMediaIds');
  for (const type of ['growth_task', 'ai2_attempt', 'ai3_attempt']) {
    for (const field of ['completionMediaIds', 'correctionMediaIds', 'practiceMediaIds']) {
      expect(protocol.validPair(type, field)).toBe(protocol.fieldFor(type) === field);
    }
  }
  expect(protocol.fieldFor('ai4_attempt')).toBeNull();
  const references = [{ mediaId: id, field: 'correctionMediaIds' }];
  const hash = value => require('crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(protocol.referenceSetHash({ resourceType: 'growth_task', references })).toBe(hash(references));
  expect(protocol.referenceSetHash({ resourceType: 'ai2_attempt', resourceId: id, references }))
    .toBe(hash({ schemaVersion: 'ai2-min-v1', resourceType: 'ai2_attempt', resourceId: id, field: 'correctionMediaIds', references }));
  expect(protocol.referenceSetHash({ resourceType: 'ai3_attempt', resourceId: id, references: [] }))
    .toBe(hash({ schemaVersion: 'ai3-min-v1', resourceType: 'ai3_attempt', resourceId: id, field: 'practiceMediaIds', references: [] }));
});

test('AI3 models require image metadata and reject crossed fields', async () => {
  const base = { familyId: id, childId: id, mediaId: id, resourceId: id, resourceType: 'ai3_attempt',
    field: 'practiceMediaIds', operationId: randomUUID(), state: 'bound' };
  await expect(new Reference(base).validate()).resolves.toBeUndefined();
  await expect(new Reference({ ...base, field: 'correctionMediaIds' }).validate()).rejects.toThrow();
  const tomb = { familyId: id, childId: id, mediaId: id, actorId: id, role: 'student', purpose: 'ai3_practice',
    reason: 'user_requested', deletedAt: new Date(), mimeType: 'image/png', sizeBytes: 1 };
  await expect(new Tombstone(tomb).validate()).resolves.toBeUndefined();
  await expect(new Tombstone({ ...tomb, sizeBytes: undefined }).validate()).rejects.toThrow();
  await expect(new Tombstone({ ...tomb, mimeType: 'application/pdf' }).validate()).rejects.toThrow();
  const receipt = { ...base, bindingOperationId: base.operationId, releasedAt: new Date() };
  delete receipt.operationId; delete receipt.state;
  await expect(new Receipt(receipt).validate()).resolves.toBeUndefined();
  await expect(new Receipt({ ...receipt, resourceType: 'ai2_attempt' }).validate()).rejects.toThrow();
  const asset = { familyId: id, childId: id, uploadedBy: id, purpose: 'ai3_practice', mimeType: 'image/webp',
    sizeBytes: 10 * 1024 * 1024, storageKey: randomUUID() };
  await expect(new Asset(asset).validate()).resolves.toBeUndefined();
  await expect(new Asset({ ...asset, mimeType: 'application/pdf', pageCount: 1 }).validate()).rejects.toThrow();
});

test('common client accepts AI3 typed responses, rejects cross-type responses and invalid batches', async () => {
  const command = { familyId: id, childId: id, resourceType: 'ai3_attempt', resourceId: id,
    remoteOperationId: randomUUID(), commandHash: 'b'.repeat(64), references: [{ mediaId: id, field: 'practiceMediaIds' }] };
  const post = jest.fn(async () => ({ status: 200, data: { success: true, data: {
    operation: { ...protocol.typedScope(command), operationId: command.remoteOperationId, commandHash: command.commandHash,
      referenceSetHash: protocol.referenceSetHash(command), state: 'COMMITTED', leaseExpiresAt: null, leaseExpired: null, failureCode: null },
    references: [{ ...protocol.typedScope(command), mediaId: id, field: 'practiceMediaIds', state: 'bound',
      bindingOperationId: command.remoteOperationId, privacyDeletion: null }]
  } } }));
  const client = createCompletionMediaReferenceClient({ axiosInstance: { post }, resourceServiceUrl: 'http://127.0.0.1:1234',
    serviceToken: 'synthetic-reference-token-at-least-32-characters' });
  expect((await client.commit(command)).operation.resourceType).toBe('ai3_attempt');
  const good = post.getMockImplementation();
  post.mockImplementationOnce(async () => {
    const response = await good(); response.data.data.operation.resourceType = 'ai2_attempt'; return response;
  });
  await expect(client.commit(command)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  for (const references of [[], new Array(1), Array(11).fill(command.references[0]),
    [command.references[0], command.references[0]], [{ mediaId: id, field: 'correctionMediaIds' }]]) {
    await expect(client.prepare({ ...command, references })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  }
  expect(post).toHaveBeenCalledTimes(2);
});

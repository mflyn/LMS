process.env.JWT_SECRET = 'synthetic-isolation-jwt-secret-32-characters';
process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-isolation-gateway-secret-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/synthetic-unused';

const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { request, close: closeHttp } = createHttpTestHarness();
afterEach(closeHttp);
const { createProductionApp } = require('../server');
const { createMediaReferenceClient } = require('../../../common/services/mediaReferenceClient');
const TOKEN = 'synthetic-isolation-service-token-32-characters';
const startSession = jest.fn(() => { throw new Error('Production isolation probe must not use a database'); });
const connection = require('mongoose').connection;
beforeEach(() => jest.spyOn(connection, 'startSession').mockImplementation(startSession));
afterEach(() => jest.restoreAllMocks());
// These original production-isolation assertions apply to legacy; enabled/maintenance are verified by formal assembly tests.
const app = createProductionApp({ connection, env: { NODE_ENV: 'test', COMPLETION_PROTOCOL_MODE: 'legacy', MEDIA_SECURITY_PROFILE: 'trusted-local',
  PRIVATE_MEDIA_ROOT: '/tmp/synthetic-unused-completion-media', MEDIA_SIGNING_SECRET: 'synthetic-isolation-signing-secret-32-characters',
  MEDIA_REFERENCE_SERVICE_TOKEN: TOKEN } });
const command = { familyId: 'a'.repeat(24), childId: 'b'.repeat(24), resourceType: 'growth_task', resourceId: 'c'.repeat(24),
  operationId: '7fe39b20-2bc9-45fb-b2d1-a91ff15a62d8', commandHash: 'd'.repeat(64),
  references: [{ mediaId: 'e'.repeat(24), field: 'completionMediaIds' }] };

test.each([['prepare', 400], ['commit', 400], ['unbind', 400], ['abort', 404], ['status', 404]])(
  'production %s does not enable the completion operation protocol', async (action, expected) => {
    const { commandHash, ...scope } = command;
    const wire = action === 'unbind' ? { ...scope,
      references: command.references.map(ref => ({ ...ref, bindingOperationId: '4d979020-09c5-4c94-8a9f-90b8fc8f0d55' })) } : command;
    const response = await (await request(app)).post(`/api/internal/media/references/${action}`).set('x-service-token', TOKEN).send(wire);
    expect(response.status).toBe(expected); expect(startSession).not.toHaveBeenCalled();
  });

test('production internal routes retain credential rejection', async () => {
  const response = await (await request(app)).post('/api/internal/media/references/prepare').send(command);
  expect(response.status).toBe(401); expect(startSession).not.toHaveBeenCalled();
});

test('production composition and the old client do not load new protocol implementations', () => {
  createMediaReferenceClient({ resourceServiceUrl: 'http://synthetic-unused', serviceToken: TOKEN });
  const excluded = ['mediaReferenceOperationService.js', 'completionMediaPrivacyService.js', 'completionMediaCleanupService.js',
    'MediaReferenceOperation.js', 'MediaDeletionTombstone.js', 'MediaDeletionReceipt.js', 'mediaDeletionJournal.js', 'completionMediaReferenceClient.js',
    'completionMediaReferences.js', 'mediaReferenceProtocolRouter.js', 'completionMediaPrivacy.js',
    'mediaReferenceOperationReadiness.js', 'completionPrivacyReadiness.js', 'completionReferenceReadiness.js',
    'completionOperations.js', 'completionStorageReadiness.js', 'mediaDeletionDispatcher.js'];
  expect(Object.keys(require.cache).filter(filename => excluded.some(name => filename.endsWith(`/${name}`)))).toEqual([]);
});

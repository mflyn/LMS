process.env.INTERNAL_SERVICE_TOKEN = 'synthetic-ai3-existing-internal-token32';
const express = require('express');
const { createHttpTestHarness } = require('../../test/httpTestHarness');
const { createAi3EvidenceRouter } = require('../../routes/ai3EvidenceRouter');
const { request, close } = createHttpTestHarness();
const token = 'synthetic-ai3-assembly-evidence-token32';
const id = 'a'.repeat(24), effectId = '00000000-0000-4000-8000-000000000001';
afterEach(close);
test.each(['homework', 'analytics', 'progress'])('%s mounts evidence ahead of generic parsers', async name => {
  const { createApp } = require(`../../../services/${name}-service/${name === 'analytics' ? 'app' : 'server'}`);
  const kind = name === 'homework' ? 'proof' : name === 'analytics' ? 'mistake' : 'mastery';
  const service = { getFinalReview: jest.fn(async () => ({ synthetic: true })), getContext: jest.fn(),
    getReceipt: jest.fn(), apply: jest.fn(async () => ({ synthetic: true })) };
  const router = createAi3EvidenceRouter({ kind, serviceToken: token, service, assertContinuous() {} });
  const app = createApp({ ai3EvidenceRouter: router });
  const path = name === 'homework' ? `/api/internal/ai3/final-reviews/${id}?familyId=${id}&childId=${id}&effectId=${effectId}`
    : `/api/internal/ai3/${kind === 'mistake' ? 'mistake-review-effects' : 'mastery-effects'}`;
  const client = await request(app);
  const result = name === 'homework' ? await client.get(path).set('x-ai3-evidence-token', token)
    : await client.post(path).set('x-ai3-evidence-token', token).send({ schemaVersion: 'ai3-review-effect-v1', effectId,
      familyId: id, childId: id, reviewedByParentId: id, finalReviewId: id, finalReviewHash: 'b'.repeat(64), targetId: id, expectedStateRevision: 0 });
  expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect(result.body.data).toEqual({ synthetic: true });
});
test('homework mounts public AI3 before its generic JSON parser', async () => {
  const { createApp } = require('../../../services/homework-service/server');
  const router = express.Router(); router.post('/practice-rounds', (req, res) => res.json(req.body));
  const response = await (await request(createApp({ ai3Router: router }))).post('/api/ai3/practice-rounds').send({ note: '<math>' });
  expect(response.status).toBe(200); expect(response.body.note).toBe('<math>');
});
test.each(['analytics', 'progress'])('%s connection cannot auto-provision indexes before AI3 preflight', async name => {
  const { connectDatabase } = require(`../../../services/${name}-service/server`);
  const env = { AI3_MODE: 'enabled', AI3_STORE_CONTINUOUS: 'true', AI2_STORE_CONTINUOUS: 'true',
    COMPLETION_PROTOCOL_MODE: 'enabled', AI3_EVIDENCE_TOKEN: token };
  const mongooseInstance = { connection: { readyState: 0, db: { admin: () => ({ command: async () => ({
    setName: 'synthetic', isWritablePrimary: true, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 }) }) } },
  connect: jest.fn(async () => {}) };
  await connectDatabase({ env, mongooseInstance, mongoURI: 'mongodb://127.0.0.1:1/synthetic-unused' });
  expect(mongooseInstance.connect).toHaveBeenCalledWith('mongodb://127.0.0.1:1/synthetic-unused',
    expect.objectContaining({ autoIndex: false, autoCreate: false }));
});

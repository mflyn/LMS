const { createT2Runtime } = require('./serviceRuntime');
const enable = () => Object.assign(process.env, { AI3_MODE: 'enabled', AI3_STORE_CONTINUOUS: 'true', AI2_STORE_CONTINUOUS: 'true' });
let runtime;
afterEach(async () => { await runtime?.stop(); runtime = null; });
test('formal AI3 runtime checks both consumers and exposes only authenticated internal endpoints', async () => {
  runtime = await createT2Runtime({ beforeStart: enable });
  expect(runtime.prechecks).toEqual(expect.arrayContaining(['ai3-progress', 'ai3-analytics', 'resource', 'homework']));
  expect(runtime.modelConnectionsMatch).toBe(true);
  const id = 'a'.repeat(24);
  const paths = [
    ['progress-service', `/api/internal/ai3/knowledge-points/${id}/review-context?familyId=${id}&childId=${id}&actorId=${id}`],
    ['analytics-service', `/api/internal/ai3/mistakes/${id}/review-context?familyId=${id}&childId=${id}&actorId=${id}`]
  ];
  for (const [name, path] of paths) {
    expect((await fetch(runtime.urls[name] + path)).status).toBe(401);
    const response = await fetch(runtime.urls[name] + path, { headers: { 'x-ai3-evidence-token': process.env.AI3_EVIDENCE_TOKEN } });
    expect(response.status).toBe(403); expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await fetch(runtime.baseUrl + path)).status).toBe(404);
  }
  const fixture = await runtime.seed(), child = await runtime.login('child');
  const FormData = require('form-data');
  const form = new FormData(); form.append('purpose', 'ai3_practice');
  form.append('file', fixture.image.bytes, { filename: fixture.image.name, contentType: fixture.image.mimeType });
  const upload = await child.post('/api/media', form, { headers: form.getHeaders() });
  expect(upload.status).toBe(201);
  const mediaId = upload.data.data.media.mediaId;
  const before = await runtime.snapshot();
  expect(before.database.UserDeletionRecovery).toEqual([]);
  expect(before.database.UploadGuard.some(guard => String(guard.mediaId) === mediaId)).toBe(true);
  const mode = process.env.AI3_MODE;
  // Runtime env is captured at assembly; verify its initially enabled privacy path uses the real journal.
  expect(mode).toBe('enabled');
  expect((await child.delete('/api/media/' + mediaId)).status).toBe(204);
  const after = await runtime.snapshot();
  expect(after.database.Tombstone.some(row => String(row.mediaId) === mediaId)).toBe(true);
  expect(after.files.some(row => row.path.endsWith(mediaId + '.json'))).toBe(true);
});
test.each(['analytics', 'progress'])('missing %s receipt index blocks the real factory preflight and closes listeners', async name => {
  let captured;
  await expect(createT2Runtime({ beforeStart: async context => {
    captured = context; enable();
    const model = require(`../../services/${name}-service/models/${name === 'analytics' ? 'Ai3ReviewEffectReceipt' : 'Ai3MasteryEffectReceipt'}`);
    await model.collection.dropIndexes();
  } })).rejects.toMatchObject({ code: 'AI3_NOT_READY' });
  expect(captured.servers.every(row => !row.server.listening)).toBe(true);
  expect(captured.mongooseInstances.every(instance => instance.connection.readyState === 0)).toBe(true);
});
test('default T2 isolates inherited AI3 activation and restores it after teardown', async () => {
  const previous = process.env.AI3_MODE;
  process.env.AI3_MODE = 'enabled';
  try {
    runtime = await createT2Runtime();
    expect(process.env.AI3_MODE).toBe('off'); expect(process.env.AI3_STORE_CONTINUOUS).toBe('false');
    expect(runtime.prechecks).not.toContain('ai3-progress');
    await runtime.stop(); expect(process.env.AI3_MODE).toBe('enabled');
  } finally { if (previous === undefined) delete process.env.AI3_MODE; else process.env.AI3_MODE = previous; }
});

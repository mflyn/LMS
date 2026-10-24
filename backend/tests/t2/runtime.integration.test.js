const fs = require('fs/promises');
const { createT2Runtime } = require('./serviceRuntime');

describe('T2 formal runtime lifecycle', () => {
  let runtime;
  afterEach(async () => { await runtime?.stop(); runtime = null; });

  test('uses official enabled startups, native indexes, private storage and loopback; stop is idempotent', async () => {
    runtime = await createT2Runtime();
    expect(runtime.mode).toBe('enabled');
    expect(runtime.cleanupEnabled).toBe(false);
    expect(runtime.mongoHello).toMatchObject({ isWritablePrimary: true, setName: expect.any(String) });
    expect(runtime.servers).toHaveLength(7);
    for (const { server, name, url } of runtime.servers) {
      expect(server.address().address).toBe('127.0.0.1');
      expect((await (await fetch(url + '/health')).json())).toMatchObject({ service: name, status: 'ok' });
    }
    expect(runtime.modelConnectionsMatch).toBe(true);
    expect(runtime.prechecks).toEqual(['user', 'progress', 'resource', 'homework']);
    const before = await runtime.snapshot();
    expect(await runtime.snapshot()).toEqual(before);
    const root = runtime.privateRoot, servers = runtime.servers.map(x => x.server);
    await runtime.stop(); await runtime.stop();
    expect(servers.every(server => !server.listening)).toBe(true);
    expect(runtime.mongooseInstances.every(x => x.connection.readyState === 0)).toBe(true);
    await expect(fs.access(root)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test.each(['index', 'homework index', 'storage'])('real startup refuses invalid %s and cleans partial resources', async fault => {
    let captured;
    await expect(createT2Runtime({ beforeStart: async context => {
      captured = context;
      if (fault === 'index') await context.resourceConnection.db.collection('completionuploadguards').dropIndexes();
      else if (fault === 'homework index') await context.homeworkConnection.db.collection('completionmediaguards').dropIndexes();
      else await fs.chmod(context.mediaRoot, 0o755);
    } })).rejects.toMatchObject({ code: { index: 'COMPLETION_RETENTION_NOT_READY',
      'homework index': 'COMPLETION_RETENTION_NOT_READY', storage: 'COMPLETION_STORAGE_NOT_READY' }[fault] });
    expect(captured.servers.map(row => row.name)).toEqual(fault === 'homework index'
      ? ['user-service', 'progress-service', 'resource-service'] : ['user-service', 'progress-service']);
    expect(captured.mongooseInstances.every(x => x.connection.readyState === 0)).toBe(true);
    expect(captured.servers.every(row => !row.server.listening)).toBe(true);
    await expect(fs.access(captured.privateRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('a second runtime cannot borrow or close the active model connection', async () => {
    runtime = await createT2Runtime();
    const before = await runtime.inspect();
    await expect(createT2Runtime()).rejects.toMatchObject({ code: 'T2_RUNTIME_ALREADY_ACTIVE' });
    expect(runtime.servers.every(row => row.server.listening)).toBe(true);
    expect(await runtime.inspect()).toEqual(before);
  });
});

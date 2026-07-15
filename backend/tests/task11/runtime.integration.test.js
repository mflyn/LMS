const fs = require('fs/promises');
const axios = require('axios');
const { createFamilyRuntime } = require('./serviceRuntime');

describe('Task 11 real-service runtime', () => {
  let runtime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
    runtime = null;
  });

  test('starts a replica set, six services, and the gateway then closes every resource', async () => {
    runtime = await createFamilyRuntime();

    expect(runtime.mongoHello).toEqual(expect.objectContaining({
      isWritablePrimary: true,
      setName: expect.any(String)
    }));
    expect(runtime.servers).toHaveLength(7);
    expect(runtime.servers.every(({ server }) => server.listening)).toBe(true);

    for (const [name, url] of Object.entries(runtime.urls)) {
      const response = await axios.get(`${url}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(expect.objectContaining({ status: 'ok' }));
      expect(response.data.service).toBe(name);
    }

    const privateRoot = runtime.privateRoot;
    const servers = runtime.servers.map(({ server }) => server);
    await runtime.stop();

    expect(servers.every((server) => !server.listening)).toBe(true);
    expect(runtime.mongooseInstances.every(({ connection }) => connection.readyState === 0)).toBe(true);
    await expect(fs.access(privateRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('teardown remains idempotent after a forced test-path failure', async () => {
    runtime = await createFamilyRuntime();
    const privateRoot = runtime.privateRoot;

    try {
      throw new Error('forced task11 lifecycle failure');
    } catch (error) {
      expect(error.message).toBe('forced task11 lifecycle failure');
    } finally {
      await runtime.stop();
      await runtime.stop();
    }

    expect(runtime.mongooseInstances.every(({ connection }) => connection.readyState === 0)).toBe(true);
    await expect(fs.access(privateRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

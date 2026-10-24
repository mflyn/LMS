const http = require('http');
const supertest = require('supertest');

// Supertest's implicit listener uses a wildcard, but its client uses IPv4.
// Own explicit loopback listeners instead, including their teardown on failure.
const createHttpTestHarness = () => {
  const listeners = new Map();

  const request = async app => {
    if (!listeners.has(app)) {
      const server = http.createServer(app);
      const ready = new Promise((resolve, reject) => {
        const onError = error => reject(error);
        server.once('error', onError);
        server.listen(0, '127.0.0.1', () => {
          server.removeListener('error', onError);
          resolve(server);
        });
      });
      listeners.set(app, ready);
      ready.catch(() => {
        if (listeners.get(app) === ready) listeners.delete(app);
      });
    }
    return supertest(await listeners.get(app));
  };

  const close = async () => {
    const pending = [...listeners.values()];
    listeners.clear();
    const started = await Promise.allSettled(pending);
    const closed = await Promise.allSettled(started
      .filter(result => result.status === 'fulfilled')
      .map(({ value: server }) => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      })));
    // Report failures only after every successfully started listener is closed.
    const failed = [...started, ...closed].find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  };

  return { request, close };
};

module.exports = { createHttpTestHarness };

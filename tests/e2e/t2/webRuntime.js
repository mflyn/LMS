const path = require('path');
const fs = require('fs/promises');
const http = require('http');
const express = require('express');
const { createT2Runtime } = require('../../../backend/tests/t2/serviceRuntime');

const createT2WebRuntime = async () => {
  const build = process.env.T2_WEB_BUILD;
  if (!build || !path.isAbsolute(build)) throw new Error('T2_WEB_BUILD must name an existing absolute frontend build');
  await fs.access(path.join(build, 'index.html'));
  const runtime = await createT2Runtime();
  let server;
  const stop = async () => {
    try {
      if (server?.listening) await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve()); server.closeAllConnections?.();
      });
    } finally { await runtime.stop(); }
  };
  try {
    const fixture = await runtime.seed();
    const app = express();
    // Stream multipart bodies and signed responses unchanged to the real Gateway.
    app.use('/api', (req, res) => {
      const target = new URL(req.originalUrl, runtime.gatewayUrl);
      const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
        response.on('error', () => res.destroy());
      });
      upstream.on('error', () => res.destroy());
      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
    });
    app.use(express.static(build));
    app.get('*', (_req, res) => res.sendFile(path.join(build, 'index.html')));
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.once('error', reject);
    });
    return { ...runtime, fixture, webUrl: `http://127.0.0.1:${server.address().port}`, stop };
  } catch (error) { await stop(); throw error; }
};
module.exports = { createT2WebRuntime };

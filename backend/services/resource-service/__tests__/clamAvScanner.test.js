const net = require('net');

const { createClamAvScanner } = require('../services/clamAvScanner');

const startFakeClamd = async (onCommand) => {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    let command = null;
    const chunks = [];

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      if (!command) {
        const terminator = buffer.indexOf(0);
        if (terminator < 0) return;
        command = buffer.subarray(0, terminator).toString('ascii');
        buffer = buffer.subarray(terminator + 1);
        if (command === 'zPING') onCommand({ command, chunks, socket });
      }
      if (command !== 'zINSTREAM') return;

      while (buffer.length >= 4) {
        const length = buffer.readUInt32BE(0);
        if (buffer.length < 4 + length) return;
        buffer = buffer.subarray(4);
        if (length === 0) {
          onCommand({ command, chunks, socket });
          return;
        }
        chunks.push(buffer.subarray(0, length));
        buffer = buffer.subarray(length);
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    host: '127.0.0.1',
    port: address.port,
    sockets,
    close: async () => {
      sockets.forEach((socket) => socket.destroy());
      await new Promise((resolve) => server.close(resolve));
    }
  };
};

const scannerFor = (server, overrides = {}) => createClamAvScanner({
  host: server.host,
  port: server.port,
  connectTimeoutMs: 100,
  scanTimeoutMs: 100,
  chunkSize: 8,
  maxResponseBytes: 64,
  ...overrides
});

const expectUnavailable = async (promise) => {
  await expect(promise).rejects.toMatchObject({
    code: 'MALWARE_SCANNER_UNAVAILABLE',
    statusCode: 503,
    isOperational: true
  });
};

describe('ClamAV TCP scanner adapter', () => {
  test('TC-MPA-SCAN-003/007 sends bounded PING and exact INSTREAM frames', async () => {
    const requests = [];
    const server = await startFakeClamd((request) => {
      requests.push(request);
      request.socket.end(request.command === 'zPING' ? 'PONG\0' : 'stream: OK\0');
    });
    const scanner = scannerFor(server);
    const canonical = Buffer.from('0123456789abcdefXYZ');

    try {
      await expect(scanner.ping()).resolves.toBeUndefined();
      await expect(scanner.scan(canonical)).resolves.toBeUndefined();
      expect(requests.map(({ command }) => command)).toEqual(['zPING', 'zINSTREAM']);
      expect(requests[1].chunks.map((chunk) => chunk.length)).toEqual([8, 8, 3]);
      expect(Buffer.concat(requests[1].chunks)).toEqual(canonical);
    } finally {
      await server.close();
    }
  });

  test('TC-MPA-SCAN-004 maps FOUND to a sanitized stable rejection', async () => {
    const server = await startFakeClamd(({ socket }) => {
      socket.end('stream: confidential-signature-name FOUND\0');
    });
    const scanner = scannerFor(server);

    try {
      const rejection = scanner.scan(Buffer.from('canonical bytes'));
      await expect(rejection).rejects.toMatchObject({
        code: 'MALWARE_DETECTED',
        statusCode: 422,
        isOperational: true,
        message: 'Malware detected'
      });
      await expect(rejection).rejects.not.toHaveProperty('scannerResponse');
    } finally {
      await server.close();
    }
  });

  test.each([
    ['malformed response', ({ socket }) => socket.end('stream: UNKNOWN\0'), {}],
    ['oversized response', ({ socket }) => socket.end('x'.repeat(65)), {}],
    ['scan timeout', () => undefined, { scanTimeoutMs: 20 }],
    ['closed socket', ({ socket }) => socket.destroy(), {}]
  ])('TC-MPA-SCAN-005 fails closed for %s and releases sockets', async (_label, responder, overrides) => {
    const server = await startFakeClamd(responder);
    const scanner = scannerFor(server, overrides);

    try {
      await expectUnavailable(scanner.scan(Buffer.from('canonical bytes')));
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(server.sockets.size).toBe(0);
    } finally {
      await server.close();
    }
  });

  test('TC-MPA-SCAN-005 fails closed when the scanner refuses the connection', async () => {
    const server = await startFakeClamd(() => undefined);
    const target = { host: server.host, port: server.port };
    await server.close();
    const scanner = scannerFor(target);

    await expectUnavailable(scanner.scan(Buffer.from('canonical bytes')));
  });

  test('TC-MPA-SCAN-007 sends the zero terminator for an empty stream', async () => {
    const server = await startFakeClamd(({ chunks, socket }) => {
      expect(chunks).toEqual([]);
      socket.end('stream: OK\0');
    });
    const scanner = scannerFor(server);

    try {
      await expect(scanner.scan(Buffer.alloc(0))).resolves.toBeUndefined();
    } finally {
      await server.close();
    }
  });
});

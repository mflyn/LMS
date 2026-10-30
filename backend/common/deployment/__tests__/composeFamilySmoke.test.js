const { runFamilySmoke } = require('../../../../scripts/compose-family-smoke');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { createHash } = require('crypto');

const jsonResponse = (status, data) => new Response(JSON.stringify({
  success: status >= 200 && status < 300,
  data
}), {
  status,
  headers: { 'content-type': 'application/json' }
});

describe('isolated smoke executor real CLI entry', () => {
  const repository = path.resolve(__dirname, '../../../..');
  const source = fs.readFileSync(path.join(repository, 'scripts/compose-family-smoke.js'), 'utf8');
  const executor = path.join(repository, 'scripts/run-isolated-compose-smoke.sh');
  const digest = text => createHash('sha256').update(text).digest('hex');
  let server, temporary, baseUrl, requests, failure;
  beforeEach(async () => {
    requests = []; failure = null;
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-executor-test-'));
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        requests.push({ method: req.method, url: req.url, body });
        const replies = [
          [201, { token: 'synthetic-token' }],
          [201, { family: { familyId: 'family-a' } }],
          [201, { child: { childId: 'child-a' } }],
          [201, { media: { mediaId: 'media-a' } }],
          [201, { task: { taskId: 'task-a', attachmentMediaIds: ['media-a'] } }],
          [200, { access: { url: '/api/media/media-a/content' } }]
        ];
        if (failure === 'register' && requests.length === 1) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { code: 'SYNTHETIC_UNAVAILABLE' } }));
        } else if (requests.length === 7) {
          res.writeHead(200, { 'content-type': failure === 'content' ? 'application/pdf' : 'image/png' });
          res.end('verified-image');
        } else {
          const [status, data] = replies[requests.length - 1] || [500, {}];
          res.writeHead(status, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ success: status < 400, data }));
        }
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    try {
      if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  });
  const launch = (command, args, input) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, TMPDIR: temporary, FAMILY_GATEWAY_BASE_URL: baseUrl } });
    let stdout = '', stderr = '';
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.stdin.end(input);
  });
  const execute = (input = source, hash = digest(input)) => launch('/bin/sh', [executor, hash], input);
  const expectClean = () => expect(fs.readdirSync(temporary)).toEqual([]);

  test('reproduces stdin false success, then executes the original file and sends all seven HTTP requests', async () => {
    const old = await launch(process.execPath, ['-'], source);
    expect(old).toMatchObject({ code: 0, stdout: '', stderr: '' });
    expect(requests).toEqual([]);
    const result = await execute();
    expect(result).toMatchObject({ code: 0, signal: null });
    expect(result.stdout).toContain('Family media smoke passed (14 bytes)');
    expect(requests.map(req => `${req.method} ${req.url}`)).toEqual([
      'POST /api/auth/register', 'POST /api/families', 'POST /api/children', 'POST /api/media',
      'POST /api/growth-tasks', 'GET /api/media/media-a/access', 'GET /api/media/media-a/content'
    ]);
    expect(requests[3].body).toContain('release-evidence.png');
    expect(JSON.parse(requests[4].body).attachmentMediaIds).toEqual(['media-a']);
    expectClean();
  });

  test.each(['register', 'content'])('propagates the original smoke %s assertion failure', async kind => {
    failure = kind;
    const result = await execute();
    expect(result.code).toBe(1);
    expect(result.stdout + result.stderr).toContain(kind === 'register' ? '503 (SYNTHETIC_UNAVAILABLE)' : 'signed media content was invalid');
    expect(result.stdout).not.toContain('Family media smoke passed');
    expect(requests).toHaveLength(kind === 'register' ? 1 : 7);
    expectClean();
  });

  test('uses the same sh -c argv and stdin contract as the isolated container', async () => {
    const result = await launch('/bin/sh', ['-c', fs.readFileSync(executor, 'utf8'),
      'isolated-compose-smoke', digest(source)], source);
    expect(result).toMatchObject({ code: 0, signal: null });
    expect(result.stdout).toContain('Family media smoke passed (14 bytes)');
    expect(requests).toHaveLength(7);
    expectClean();
  });

  test.each(['disabled-main', 'unrelated-output', 'empty'])('rejects zero-exit without execution: %s', async kind => {
    const input = kind === 'disabled-main' ? source.replace('if (require.main === module)', 'if (false)')
      : kind === 'unrelated-output' ? 'console.log("loaded only");' : '';
    const result = await execute(input);
    expect(result.code).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/SMOKE_(NOT_EXECUTED|SOURCE_EMPTY)/);
    expect(requests).toEqual([]);
    expectClean();
  });

  test('rejects source drift before executing any request', async () => {
    const result = await execute(source + '\n', digest(source));
    expect(result.code).toBe(1);
    expect(result.stdout + result.stderr).toContain('SMOKE_SOURCE_MISMATCH');
    expect(requests).toEqual([]);
    expectClean();
  });

  test('does not accept a success marker when the child exits nonzero', async () => {
    const result = await execute('console.log("Family media smoke passed (14 bytes)"); process.exitCode = 7;');
    expect(result.code).toBe(7);
    expectClean();
  });
});

describe('Compose family media smoke flow', () => {
  test('uses only public gateway APIs and verifies uploaded media content', async () => {
    const responses = [
      jsonResponse(201, { token: 'parent-token' }),
      jsonResponse(201, { family: { familyId: 'family-a' } }),
      jsonResponse(201, { child: { childId: 'child-a' } }),
      jsonResponse(201, { media: { mediaId: 'media-a' } }),
      jsonResponse(201, {
        task: { taskId: 'task-a', attachmentMediaIds: ['media-a'] }
      }),
      jsonResponse(200, {
        access: { url: '/api/media/media-a/content?expires=1&nonce=n&signature=s' }
      }),
      new Response(Buffer.from('verified-image'), {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
    ];
    const fetchImpl = jest.fn(async () => responses.shift());

    const result = await runFamilySmoke({
      baseUrl: 'http://127.0.0.1:3999',
      fetchImpl,
      uniqueSuffix: 'unit-with-a-deliberately-long-unique-suffix'
    });

    expect(result).toEqual({
      familyId: 'family-a',
      childId: 'child-a',
      mediaId: 'media-a',
      taskId: 'task-a',
      mediaBytes: 14
    });
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:3999/api/auth/register');
    const registrationPayload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(registrationPayload.username).toMatch(/^[a-zA-Z0-9_]{3,20}$/);
    expect(fetchImpl.mock.calls[3][1].body).toBeInstanceOf(FormData);
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toEqual(expect.objectContaining({
      childId: 'child-a',
      attachmentMediaIds: ['media-a']
    }));
    expect(fetchImpl.mock.calls[6][0]).toContain('/api/media/media-a/content');
  });
});

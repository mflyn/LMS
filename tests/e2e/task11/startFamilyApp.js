const { spawn } = require('child_process');
const path = require('path');

require('../../../backend/tests/task11/testEnvironment');
const { createFamilyRuntime } = require('../../../backend/tests/task11/serviceRuntime');
const { redactRuntimeError } = require('../../../backend/tests/task11/testEnvironment');

const repositoryRoot = path.resolve(__dirname, '../../..');
let runtime;
let frontend;
let stopping = false;

const waitForFrontend = async (url, timeoutMs = 120000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(1500)
      });
      if (response.ok) return;
    } catch {
      // The CRA server is still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Task 11 frontend did not become ready');
};

const waitForExit = (child, timeoutMs) => new Promise((resolve) => {
  if (!child || child.exitCode !== null) {
    resolve();
    return;
  }
  const timer = setTimeout(resolve, timeoutMs);
  child.once('exit', () => {
    clearTimeout(timer);
    resolve();
  });
});

const shutdown = async (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  const errors = [];

  if (frontend && frontend.exitCode === null) {
    frontend.kill('SIGTERM');
    await waitForExit(frontend, 5000);
    if (frontend.exitCode === null) frontend.kill('SIGKILL');
  }
  if (runtime) {
    try {
      await runtime.stop();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    const safeError = redactRuntimeError(errors[0], { privateRoot: runtime?.privateRoot });
    process.stderr.write(`Task 11 teardown failed: ${safeError.message}\n`);
    process.exitCode = 1;
  } else {
    process.exitCode = exitCode;
  }
};

const fail = async (error) => {
  const safeError = redactRuntimeError(error, { privateRoot: runtime?.privateRoot });
  process.stderr.write(`Task 11 app failed: ${safeError.message}\n`);
  await shutdown(1);
};

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
process.once('uncaughtException', fail);
process.once('unhandledRejection', fail);

const start = async () => {
  runtime = await createFamilyRuntime();
  frontend = spawn('npm', ['start'], {
    cwd: path.join(repositoryRoot, 'frontend/web'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: '3100',
      BROWSER: 'none',
      FAMILY_GATEWAY_URL: runtime.gatewayUrl
    },
    stdio: ['ignore', 'inherit', 'inherit']
  });
  frontend.once('exit', (code, signal) => {
    if (!stopping) fail(new Error(`Task 11 frontend exited early (${code ?? signal})`));
  });
  await waitForFrontend('http://127.0.0.1:3100/login');
  process.stdout.write('Task 11 family app ready\n');
};

start().catch(fail);

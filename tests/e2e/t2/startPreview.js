const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');

let runtime, stopping;
const stop = () => {
  if (!stopping) stopping = Promise.resolve().then(() => runtime?.stop()).catch(() => {
    process.stderr.write('T2_SYNTHETIC_PREVIEW_TEARDOWN_FAILED\n'); process.exitCode = 1;
  });
  return stopping;
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
(async () => {
  runtime = await createT2WebRuntime();
  if (stopping) return runtime.stop();
  const parent = await runtime.login('parent');
  const dueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  expectData(await parent.patch(`/api/growth-tasks/${runtime.fixture.tasks.child.taskId}`, { dueDate }));
  const { parent: account, child } = runtime.fixture.actors;
  // Only throwaway synthetic login details are printed, never tokens or capabilities.
  process.stdout.write(JSON.stringify({ syntheticOnly: true, url: runtime.webUrl,
    parent: { username: account.username, password: account.password },
    child: { familyId: child.familyId, childId: child.childId, pin: child.pin },
    mode: runtime.mode, cleanupEnabled: runtime.cleanupEnabled }, null, 2) + '\n');
})().catch(async () => {
  process.stderr.write('T2_SYNTHETIC_PREVIEW_START_FAILED\n'); process.exitCode = 1; await stop();
});

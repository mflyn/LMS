// Test-fixture lifecycle only; no external addresses, process discovery or cleanup.
function createLifecycle({ makeInstance, makeClient }) {
  let instance, client, pending, stopping, cancelled = false;
  const assertActive = () => { if (cancelled) throw Error('DRILL_CANCELLED'); };
  const start = async options => {
    assertActive();
    if (instance || pending || stopping) throw Error('INSTANCE_STILL_OWNED');
    instance = makeInstance(options);
    pending = (async () => {
      await instance.start(); assertActive();
      const uri = instance.getUri();
      if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw Error('LOOPBACK_REQUIRED');
      client = makeClient(uri);
      await client.connect(); assertActive();
      return { uri, client };
    })();
    try { return await pending; } finally { pending = null; }
  };
  const stop = ({ final = false } = {}) => {
    if (final) cancelled = true;
    if (stopping) return stopping;
    stopping = (async () => {
      // A timed-out Jest hook is not cancellation: drain startup before final stop.
      if (pending) await pending.catch(() => {});
      try { if (client) { await client.close(); client = null; } }
      finally {
        if (instance) {
          const stopped = await instance.stop({ doCleanup: false, force: false });
          if (stopped !== true) throw Error('INSTANCE_STOP_FAILED');
          instance = null;
        }
      }
    })().finally(() => { stopping = null; });
    return stopping;
  };
  return { start, stop, assertActive };
}
module.exports = { createLifecycle };

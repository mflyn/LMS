const { BSON } = require('mongodb');

// Only the explicit local product drill uses these tool/listener owners.
const indexSnapshot = rows => BSON.EJSON.stringify([...rows].sort((a, b) => a.name.localeCompare(b.name)), { relaxed: false });
function createToolOwner({ execFile, record }) {
  let owned, closed = false;
  const run = async (binary, args, options, name) => {
    if (closed) throw Error('DRILL_CANCELLED');
    if (owned) throw Error('TOOL_STILL_OWNED');
    const current = {};
    const result = new Promise(resolve => { current.child = execFile(binary, args, options,
      (error, stdout, stderr) => resolve({ error, stdout, stderr,
        status: error ? error.code : 0, signal: error?.signal || null })); });
    owned = current;
    current.done = result.then(value => { record(name, value); return value; })
      .finally(() => { if (owned === current) owned = undefined; });
    return current.done;
  };
  const stop = async () => {
    closed = true;
    if (owned) { const current = owned; current.child.kill('SIGKILL'); await current.done; }
  };
  return { run, stop };
}
function createHttpOwner(makeHarness) {
  let harness = makeHarness(), pending, closed = false;
  const request = async app => {
    if (closed || pending) throw Error('DRILL_CANCELLED');
    return harness.request(app);
  };
  const close = ({ final = false } = {}) => {
    if (final) closed = true;
    if (!pending) {
      pending = Promise.resolve().then(() => harness.close());
      pending.then(() => { if (!closed) { harness = makeHarness(); pending = undefined; } }, () => {});
    }
    return pending;
  };
  return { request, close };
}
module.exports = { indexSnapshot, createToolOwner, createHttpOwner };

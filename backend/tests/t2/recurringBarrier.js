// Local recurring-plan fault injection only; never installed by production apps.
const withRecurringBarrier = async ({ service, Command }, body) => {
  const originalExecute = service.execute, originalCreate = Command.create;
  const pending = [], state = { entered: false, commandId: null };
  let release, closing = false, result, primary;
  const barrier = new Promise(resolve => { release = resolve; });
  state.release = release;
  service.execute = function trackedExecute(...args) {
    if (closing) return Promise.reject(new Error('Recurring test barrier is closing'));
    const call = Promise.resolve().then(() => originalExecute.apply(this, args));
    // Attach rejection handling immediately while returning the original outcome to HTTP.
    pending.push(call.then(() => null, error => error));
    return call;
  };
  Command.create = async function heldCreate(...args) {
    if (!state.entered && args[0]?.[0]?.state === 'succeeded') {
      state.entered = true; state.commandId = args[0][0].operationId;
      await barrier;
    }
    return originalCreate.apply(this, args);
  };
  try { result = await body(state); }
  catch (error) { primary = error; }
  const errors = primary ? [primary] : [];
  try {
    closing = true; release();
    // execute includes transaction commit/rollback and endSession, even before the insert barrier.
    for (const error of await Promise.all(pending)) if (error && !errors.includes(error)) errors.push(error);
  } catch (error) { if (!errors.includes(error)) errors.push(error); }
  finally { service.execute = originalExecute; Command.create = originalCreate; }
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, 'Recurring test body and execution cleanup failed');
  return result;
};
module.exports = { withRecurringBarrier };

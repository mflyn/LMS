const Plan = require('../models/RecurringTaskPlan');
const Cursor = require('../models/RecurringTaskScanState');
const { error } = require('./growthTaskCompletionCommand');
const KEY = 'recurring-task-plans-v1';
const createRecurringTaskPlanScanner = ({ service, enabled, logger = { warn() {} }, stopTimeoutMs = 15000 } = {}) => {
  let stopping = false, timer = null, active = null;
  let shutdownFailure = false;
  const unresolved = new Set();
  let health = { complete: false, healthy: false, code: 'NOT_SCANNED' };
  const run = async () => {
    if (stopping || !enabled()) return { complete: false, healthy: false, processed: 0, code: 'STOPPED' };
    let cursor = await Cursor.findById(KEY).lean();
    if (!cursor) {
      try { await Cursor.create({ _id: KEY }); } catch (cause) { if (cause.code !== 11000) throw cause; }
      cursor = await Cursor.findById(KEY).lean();
    }
    if (!cursor || !Number.isSafeInteger(cursor.version) || cursor.version < 0 || cursor.version >= Number.MAX_SAFE_INTEGER
      || !Number.isSafeInteger(cursor.failures) || cursor.failures < 0
      || !Number.isSafeInteger(cursor.healthWriteFailures ?? 0) || (cursor.healthWriteFailures ?? 0) < 0) {
      throw error(503, 'RECURRING_SCAN_STATE_INVALID');
    }
    // A successful final commit can lose its reply and leave the normal eligibility set.
    // Recheck this process's unknowns with the same idempotent service before forgetting them.
    const eligible = { status: 'active', $or: [{ pendingRevision: { $ne: null } }, { 'currentRevision.endDate': null },
      { $expr: { $lt: ['$lastEvaluatedDate', '$currentRevision.endDate'] } }] };
    const plans = await Plan.find({ ...(cursor.afterId ? { _id: { $gt: cursor.afterId } } : {}),
      $or: [eligible, ...(unresolved.size ? [{ _id: { $in: [...unresolved] } }] : [])] })
      .sort({ _id: 1 }).limit(50).select('_id generationFence').lean();
    let failures = cursor.failures, healthWriteFailures = cursor.healthWriteFailures ?? 0, processed = 0;
    for (const plan of plans) {
      if (stopping || !enabled()) return { complete: false, healthy: false, processed, code: 'STOPPED' };
      const planId = String(plan._id);
      try { await service.generate({ planId }); unresolved.delete(planId); }
      catch (cause) {
        if (cause?.code === 'RECURRING_PLAN_WRITE_UNKNOWN') unresolved.add(planId);
        if (stopping || !enabled()) {
          shutdownFailure = true;
          throw error(503, 'RECURRING_SCAN_STOP_UNKNOWN');
        }
        failures++;
        if (!Number.isSafeInteger(failures)) throw error(503, 'RECURRING_SCAN_STATE_INVALID');
        // Never overwrite a newer generation's success or a concurrently stopped plan.
        try {
          await Plan.updateOne({ _id: plan._id, generationFence: plan.generationFence, status: 'active' },
            { $set: { lastFailureCode: unresolved.has(planId) ? 'RECURRING_PLAN_WRITE_UNKNOWN' : 'RECURRING_PLAN_GENERATION_FAILED' } },
            { timestamps: false });
        } catch {
          // The page receipt preserves this failure if the per-plan health write is unavailable.
          // Do not let an auxiliary write starve the remaining plans or the next page.
          healthWriteFailures++;
          if (!Number.isSafeInteger(healthWriteFailures)) throw error(503, 'RECURRING_SCAN_STATE_INVALID');
          logger.warn('Recurring health persistence failed', { code: 'RECURRING_SCAN_HEALTH_WRITE_FAILED' });
        }
      }
      processed++;
      await new Promise(resolve => setImmediate(resolve));
    }
    if (stopping || !enabled()) return { complete: false, healthy: false, processed, code: 'STOPPED' };
    const complete = plans.length < 50;
    const changed = await Cursor.updateOne({ _id: KEY, version: cursor.version }, { $set: {
      afterId: complete ? null : plans.at(-1)._id, failures: complete ? 0 : failures,
      healthWriteFailures: complete ? 0 : healthWriteFailures,
      ...(complete ? { lastRoundFailures: failures, lastRoundHealthWriteFailures: healthWriteFailures } : {}) }, $inc: { version: 1 } });
    if (changed.matchedCount !== 1) throw error(503, 'RECURRING_SCAN_CURSOR_CONFLICT');
    return { processed, failures, healthWriteFailures, complete, healthy: complete && failures === 0 && unresolved.size === 0 };
  };
  const tick = () => {
    if (active) return active;
    active = run().then(result => { health = result; return { ...result }; }, cause => {
      const code = cause?.code === 'RECURRING_SCAN_STOP_UNKNOWN' ? cause.code : 'RECURRING_SCAN_FAILED';
      health = { complete: false, healthy: false, code };
      logger.warn('Recurring scan failed', { code: health.code });
      throw error(503, code);
    }).finally(() => { active = null; });
    return active;
  };
  const start = () => {
    if (timer || stopping || !enabled()) return;
    // One bounded page per tick. A persisted cursor resumes the unfinished round after restart.
    const fire = () => { void tick().catch(() => {}); };
    timer = setInterval(fire, 60000); timer.unref(); fire();
  };
  const stop = async () => {
    stopping = true;
    if (timer) clearInterval(timer);
    timer = null;
    if (shutdownFailure || !active && unresolved.size) throw error(503, 'RECURRING_SCAN_STOP_UNKNOWN');
    if (!active) return;
    let deadline;
    try { await Promise.race([active, new Promise((_, reject) => {
      deadline = setTimeout(() => reject(error(503, 'RECURRING_SCAN_STOP_UNKNOWN')), stopTimeoutMs);
    })]);
    if (shutdownFailure || unresolved.size) throw error(503, 'RECURRING_SCAN_STOP_UNKNOWN');
    } finally { clearTimeout(deadline); }
  };
  return { tick, start, stop, getHealth: () => ({ ...health }) };
};
module.exports = { createRecurringTaskPlanScanner };

const FAILURE_CODES = new Set(['COMPLETION_PROTOCOL_NOT_READY', 'COMPLETION_REFERENCES_NOT_READY',
  'COMPLETION_STORAGE_NOT_READY', 'COMPLETION_CLEANUP_FAILED', 'COMPLETION_RETENTION_DISABLED',
  'COMPLETION_RETENTION_NOT_READY', 'COMPLETION_ORPHAN_CLEANUP_FAILED', 'INVALID_OPERATIONS_ARGUMENTS']);

const parse = args => {
  if (['orphan-inventory', 'orphan-cleanup'].includes(args[0])) {
    const action = args[0], input = args.slice(args[1] === 'resource' ? 2 : 1), flags = [];
    for (let i = 0; i < input.length; i += 1) {
      if (input[i] === '--limit' && i + 1 < input.length) flags.push('--limit=' + input[++i]);
      else flags.push(input[i]);
    }
    if (!flags.includes('--writes-paused') || new Set(flags).size !== flags.length) return null;
    if (action === 'orphan-inventory') return flags.length === 1 ? { action, service: 'resource' } : null;
    if (!flags.includes('--apply') || flags.some(f => !['--writes-paused', '--apply'].includes(f) && !/^--limit=[1-9][0-9]*$/.test(f))) return null;
    const limits = flags.filter(f => f.startsWith('--limit='));
    const limit = limits.length ? Number(limits[0].slice(8)) : 50;
    return limits.length <= 1 && limit <= 100 ? { action, service: 'resource', limit } : null;
  }
  const [action, service, ...flags] = args;
  if (!['check', 'cleanup'].includes(action) || !['homework', 'resource'].includes(service)
    || !flags.includes('--writes-paused') || new Set(flags).size !== flags.length) return null;
  if (action === 'check') return flags.length === 1 ? { action, service } : null;
  if (service !== 'resource' || !flags.includes('--execute')
    || flags.some(flag => !['--writes-paused', '--execute'].includes(flag) && !/^--limit=[1-9][0-9]*$/.test(flag))) return null;
  const limits = flags.filter(flag => flag.startsWith('--limit='));
  if (limits.length > 1) return null;
  const limit = limits.length ? Number(limits[0].slice(8)) : 100;
  return limit <= 1000 ? { action, service, limit } : null;
};
const connectService = async uri => {
  const mongoose = require('mongoose');
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000, socketTimeoutMS: 15000 });
  return mongoose.connection;
};
const disconnectService = async () => require('mongoose').disconnect();

const runCompletionOperations = async ({ args = process.argv.slice(2), env = process.env,
  connect = connectService, disconnect = disconnectService } = {}) => {
  const command = parse(args);
  if (!command) return { success: false, code: 'INVALID_OPERATIONS_ARGUMENTS' };
  if (typeof env.MONGO_URI !== 'string' || !env.MONGO_URI.trim()) return { success: false, code: 'COMPLETION_CONFIGURATION_REQUIRED' };
  let result;
  try {
    const connection = await connect(env.MONGO_URI);
    if (command.action.startsWith('orphan-')) {
      const { orphanInventory, runOrphanCleanup } = require('../backend/services/resource-service/services/orphanRetentionOperations');
      const options = { connection, writesPaused: true, env, execute: true, limit: command.limit };
      result = { success: true, ...await (command.action === 'orphan-inventory' ? orphanInventory(options) : runOrphanCleanup(options)) };
    } else if (command.service === 'homework') {
      const { assertGrowthTaskCompletionReadiness } = require('../backend/services/homework-service/services/growthTaskCompletionReadiness');
      result = { success: true, ...await assertGrowthTaskCompletionReadiness({ connection, writesPaused: true }), productionEnabled: false };
      if (env.COMPLETION_PROTOCOL_MODE === 'enabled') {
        require('../backend/common/middleware/completionRetirementCredential').createCompletionRetirementCredential(env);
        await require('../backend/services/homework-service/services/completionMediaGuardReadiness')
          .assertCompletionMediaGuardReadiness({ connection, writesPaused: true });
      }
    } else {
      const { checkCompletionOperations, runCompletionCleanup } = require('../backend/services/resource-service/services/completionOperations');
      const options = { connection, writesPaused: true, env, execute: true, limit: command.limit };
      result = { success: true, ...await (command.action === 'check' ? checkCompletionOperations(options) : runCompletionCleanup(options)) };
    }
  } catch (error) {
    result = { success: false, code: FAILURE_CODES.has(error?.code) ? error.code : 'COMPLETION_OPERATIONS_FAILED' };
    if (error?.code === 'COMPLETION_ORPHAN_CLEANUP_FAILED' && error.counts
      && ['inspected', 'purged', 'skipped', 'failed'].every(k => Number.isSafeInteger(error.counts[k]) && error.counts[k] >= 0)) {
      result.counts = Object.fromEntries(['inspected', 'purged', 'skipped', 'failed'].map(k => [k, error.counts[k]]));
    }
  } finally {
    try { await disconnect(); }
    catch (_cause) { result = { success: false, code: 'COMPLETION_DISCONNECT_FAILED' }; }
  }
  return result;
};

if (require.main === module) {
  runCompletionOperations().then(result => {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.success ? 0 : 1;
  }).catch(() => {
    process.stdout.write('{"success":false,"code":"COMPLETION_OPERATIONS_FAILED"}\n');
    process.exitCode = 1;
  });
}
module.exports = { runCompletionOperations };

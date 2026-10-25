const { assertCompletionReferenceReadiness } = require('./completionReferenceReadiness');
const { assertCompletionStorageReadiness } = require('./completionStorageReadiness');

const check = async ({ connection, writesPaused, env = process.env } = {}, recovery = false) => {
  // Configuration is resolved without opening sockets or provisioning journal directories.
  const retention = env.COMPLETION_PROTOCOL_MODE === 'enabled'
    ? require('./orphanRetentionRuntime').createRetentionReadDependencies(env) : {};
  const recoveryOptions = recovery ? { allowMissingDeletedJournal: true, allowSupersededRetirementRecovery: true } : {};
  await assertCompletionReferenceReadiness({ connection, writesPaused, ...retention, ...recoveryOptions });
  await assertCompletionStorageReadiness({ env });
  if (env.COMPLETION_PROTOCOL_MODE === 'enabled') {
    await require('./completionRetentionReadiness').assertCompletionRetentionReadiness({ connection, writesPaused, ...retention, ...recoveryOptions });
  }
  return { ready: !recovery, ...(recovery ? { recoverable: true } : {}),
    service: 'resource-service', protocol: 'task-completion-v1', productionEnabled: false };
};
const checkCompletionOperations = options => check(options);
const checkCompletionRecovery = options => {
  if (options?.env?.COMPLETION_PROTOCOL_MODE !== 'enabled') {
    throw Object.assign(new Error('COMPLETION_RETENTION_DISABLED'), { code: 'COMPLETION_RETENTION_DISABLED' });
  }
  return check(options, true);
};

const runCompletionCleanup = async ({ connection, writesPaused, env = process.env, execute, limit = 100 } = {}) => {
  if (execute !== true || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw Object.assign(new Error('Explicit cleanup execution and a valid limit are required'), { code: 'INVALID_OPERATIONS_ARGUMENTS' });
  }
  // No cached readiness grant: recheck the stopped system and storage on every invocation.
  await checkCompletionOperations({ connection, writesPaused, env });
  const mediaRoot = env.PRIVATE_MEDIA_ROOT, journalRoot = env.COMPLETION_DELETION_JOURNAL_ROOT;
  const mongoose = require('mongoose');
  if (connection !== mongoose.connection) {
    throw Object.assign(new Error('Cleanup requires the service model connection'), { code: 'COMPLETION_CLEANUP_FAILED' });
  }
  // Load writers only after preflight; the CLI disables autoIndex/autoCreate before connecting.
  const { createMongoTransactionRunner } = require('./mongoTransaction');
  const { createMediaDeletionJournal } = require('./mediaDeletionJournal');
  const { createPrivateMediaStore } = require('./privateMediaStore');
  const { createCompletionMediaCleanupService } = require('./completionMediaCleanupService');
  try {
    const service = createCompletionMediaCleanupService({ transactionRunner: createMongoTransactionRunner(connection),
      journal: createMediaDeletionJournal({ root: journalRoot }), mediaStore: createPrivateMediaStore({ root: mediaRoot }) });
    const result = await service.cleanupDeletedMedia({ limit });
    return { cleaned: result.cleaned };
  } catch (_cause) {
    // A batch can partially complete. Keep durable evidence and require an explicit rerun.
    throw Object.assign(new Error('Completion cleanup failed; inspect protected evidence before retry'), {
      code: 'COMPLETION_CLEANUP_FAILED'
    });
  }
};

module.exports = { checkCompletionOperations, checkCompletionRecovery, runCompletionCleanup };

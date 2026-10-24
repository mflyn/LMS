const path = require('path');
const { createCompletionRetirementCredential } = require('../../../common/middleware/completionRetirementCredential');
const { createCompletionRetirementClient } = require('../../../common/services/completionRetirementClient');
const { createOrphanRetirementJournal } = require('./orphanRetirementJournal');

const resolveRetentionConfiguration = (env = process.env) => {
  createCompletionRetirementCredential(env);
  if (env.COMPLETION_ORPHAN_CLEANUP_ENABLED !== undefined
    && !['false', 'true'].includes(env.COMPLETION_ORPHAN_CLEANUP_ENABLED)) {
    throw Object.assign(new Error('Invalid retention configuration'), { code: 'COMPLETION_CONFIGURATION_REQUIRED' });
  }
  const root = env.COMPLETION_DELETION_JOURNAL_ROOT;
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) !== root) {
    throw Object.assign(new Error('Invalid retention journal configuration'), { code: 'COMPLETION_CONFIGURATION_REQUIRED' });
  }
  return { uploadRoot: path.join(root, 'uploads-v1'), orphanRoot: path.join(root, 'orphan-retirements-v1'),
    baseUrl: env.HOMEWORK_SERVICE_URL || 'http://homework-service:3003', token: env.COMPLETION_RETIREMENT_SERVICE_TOKEN };
};
const createRetentionReadDependencies = (env = process.env) => {
  const config = resolveRetentionConfiguration(env);
  return { journal: createOrphanRetirementJournal({ root: config.orphanRoot }),
    retirementClient: createCompletionRetirementClient({ baseUrl: config.baseUrl, token: config.token }) };
};
const createRetentionDependencies = (env = process.env) => {
  const { createCompletionUploadJournal } = require('./completionUploadJournal');
  return { ...createRetentionReadDependencies(env),
    uploadJournal: createCompletionUploadJournal({ root: resolveRetentionConfiguration(env).uploadRoot }) };
};
module.exports = { resolveRetentionConfiguration, createRetentionDependencies, createRetentionReadDependencies };

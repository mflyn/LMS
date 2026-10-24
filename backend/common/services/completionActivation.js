const SAFE_CODES = new Set(['INVALID_COMPLETION_MODE', 'COMPLETION_WRITES_NOT_PAUSED',
  'COMPLETION_LEGACY_UNSAFE', 'COMPLETION_PROTOCOL_NOT_READY', 'COMPLETION_REFERENCES_NOT_READY',
  'COMPLETION_STORAGE_NOT_READY', 'COMPLETION_ASSEMBLY_NOT_READY', 'COMPLETION_CONFIGURATION_REQUIRED',
  'COMPLETION_CONNECTION_MISMATCH', 'COMPLETION_STARTUP_CLEANUP_FAILED',
  'COMPLETION_RETENTION_NOT_READY', 'COMPLETION_MEDIA_GUARDS_NOT_READY']);
const startupError = code => Object.assign(new Error(code), { code });
const sanitize = cause => startupError(SAFE_CODES.has(cause?.code) ? cause.code : 'COMPLETION_STARTUP_FAILED');

const resolveCompletionMode = (env = process.env) => {
  const mode = env.COMPLETION_PROTOCOL_MODE === undefined ? 'legacy' : env.COMPLETION_PROTOCOL_MODE;
  if (!['legacy', 'maintenance', 'enabled'].includes(mode)) throw startupError('INVALID_COMPLETION_MODE');
  return mode;
};

// Only services with a complete formal composition may activate the protocol.
const assertCompletionAssemblyAvailable = (mode, service) => {
  if (mode === 'enabled' && !['resource', 'homework'].includes(service)) throw startupError('COMPLETION_ASSEMBLY_NOT_READY');
};

const assertCompletionConnection = (connection, modelConnection) => {
  if (connection !== modelConnection) throw startupError('COMPLETION_CONNECTION_MISMATCH');
};

const assertLegacyCompletionState = async ({ connection, service }) => {
  const taskState = { $or: [
    { activeCompletionOperation: { $ne: null } }, { completionPending: { $ne: null } },
    { completionVersion: { $exists: true, $ne: 0 } }, { checklistVersion: { $exists: true, $ne: 0 } },
    { completionEvidence: { $ne: null } }, { completionMediaBindings: { $ne: null } },
    { completionMediaReferenceState: 'pending_recovery' }
  ] };
  const queries = service === 'homework'
    ? [['growthtaskcompletionoperations', {}], ['growthtasks', taskState], ['completionmediaguards', {}]]
    : [['mediareferenceoperations', {}], ['mediadeletiontombstones', {}], ['mediadeletionreceipts', {}],
      ['mediareferences', { field: 'completionMediaIds' }], ['completionuploadguards', {}], ['mediaorphanretirements', {}]];
  try {
    for (const [name, query] of queries) {
      if (await connection.db.collection(name).findOne(query, {
        projection: { _id: 1 }, readPreference: 'primary', maxTimeMS: 5000
      })) throw startupError('COMPLETION_LEGACY_UNSAFE');
    }
  } catch (cause) {
    throw startupError(cause?.code === 'COMPLETION_LEGACY_UNSAFE' ? cause.code : 'COMPLETION_PROTOCOL_NOT_READY');
  }
};

const maintenanceApps = new WeakSet();
const withCompletionMode = (app, { mode, service, env }) => {
  assertCompletionAssemblyAvailable(mode, service);
  if (mode !== 'maintenance' || maintenanceApps.has(app)) return app;
  const express = require('express');
  const { authenticateGateway } = require('../middleware/auth');
  const { errorHandler, requestTracker } = require('../middleware/errorHandler');
  const guarded = express();
  // Mounted handlers use the inner req.app; share queue/scanner lifecycle state.
  guarded.locals = app.locals;
  guarded.locals.serviceName = service + '-service';
  guarded.use(requestTracker);
  const unavailable = (req, res) => res.status(503).json({ success: false,
    error: { code: 'COMPLETION_MAINTENANCE', message: 'COMPLETION_MAINTENANCE', details: [] } });
  if (service === 'homework') guarded.use('/api/growth-tasks', authenticateGateway, unavailable);
  else {
    const { createMediaReferenceCredential } = require('../../services/resource-service/middleware/mediaReferenceCredential');
    guarded.use('/api/internal/media/references', createMediaReferenceCredential(env.MEDIA_REFERENCE_SERVICE_TOKEN), unavailable);
    // Content uses signed capabilities, not gateway identity; deny without reading any bytes.
    guarded.use('/api/media/:mediaId/content', unavailable);
    guarded.use('/api/media', authenticateGateway, unavailable);
  }
  guarded.get('/health', (req, res) => res.json({ status: 'maintenance', service: service + '-service',
    completion: { mode: 'maintenance', ready: false } }));
  guarded.use(app);
  guarded.use(errorHandler);
  maintenanceApps.add(guarded);
  return guarded;
};

const closeQueue = async queue => {
  const failures = [];
  for (const resource of [queue?.channel, queue?.connection]) {
    try { if (typeof resource?.close === 'function') await resource.close(); } catch (cause) { failures.push(cause); }
  }
  if (failures.length) throw startupError('COMPLETION_STARTUP_CLEANUP_FAILED');
};

const startCompletionService = async ({ service, env, connection, connect, checkEnabled,
  validateEnvironment = () => {}, app, createRuntimeApp, initializeRuntime = async () => {},
  port, host, appLogger }) => {
  let ownsConnection = false, server, runtimeApp, previousQueue;
  try {
    const mode = resolveCompletionMode(env);
    if (mode === 'enabled' && env.COMPLETION_WRITES_PAUSED !== 'true') throw startupError('COMPLETION_WRITES_NOT_PAUSED');
    if (mode === 'enabled' && (typeof env.MONGO_URI !== 'string' || !env.MONGO_URI.trim())) {
      throw startupError('COMPLETION_CONFIGURATION_REQUIRED');
    }
    validateEnvironment(env);
    ownsConnection = connection.readyState === 0;
    await connect();
    if (mode === 'legacy') await assertLegacyCompletionState({ connection, service });
    if (mode === 'enabled') await checkEnabled({ connection, writesPaused: env.COMPLETION_WRITES_PAUSED === 'true', env });
    assertCompletionAssemblyAvailable(mode, service);
    if (mode === 'enabled' && app) throw startupError('COMPLETION_ASSEMBLY_NOT_READY');
    runtimeApp = app || await createRuntimeApp({ env, connection, appLogger });
    runtimeApp = withCompletionMode(runtimeApp, { mode, service, env });
    previousQueue = runtimeApp.locals?.mq;
    await initializeRuntime({ app: runtimeApp, env });
    await new Promise((resolve, reject) => {
      const ready = () => resolve();
      server = host === undefined ? runtimeApp.listen(port, ready) : runtimeApp.listen(port, host, ready);
      server.once('error', reject);
    });
    appLogger.info(service + ' service started', { port: server.address().port, completionMode: mode });
    return server;
  } catch (cause) {
    let cleanupFailed = false;
    // Attempt every owned cleanup even if an earlier one fails.
    try {
      if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } catch (_error) { cleanupFailed = true; }
    if (runtimeApp?.locals?.mq !== previousQueue) {
      try { await closeQueue(runtimeApp?.locals?.mq); } catch (_error) { cleanupFailed = true; }
    }
    if (ownsConnection) {
      try { await connection.close(); } catch (_error) { cleanupFailed = true; }
    }
    throw cleanupFailed ? startupError('COMPLETION_STARTUP_CLEANUP_FAILED') : sanitize(cause);
  }
};

module.exports = { resolveCompletionMode, assertCompletionAssemblyAvailable, assertLegacyCompletionState,
  assertCompletionConnection, withCompletionMode, startCompletionService, closeQueue };

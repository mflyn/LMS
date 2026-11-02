const mongoose = require('mongoose');
const C = require('./ai1Contract');
const M = require('../models/Ai1');
const { createOperationClient } = require('./ai1Operation');
const { assertAi1Indexes } = require('./ai1Readiness');
const { assertTransactionCapability } = require('../../../common/services/mongoTransaction');

const unavailable = () => C.error(503, 'AI_PROFILE_UNAVAILABLE');
const PROFILE_KEYS = ['model', 'modelProfileVersion', 'pricingProfileVersion', 'checkedAt', 'expiresAt',
  'callWindowMs', 'clockMarginMs', 'inputPriceMicrosPerMillion', 'outputPriceMicrosPerMillion'];
const BUDGET_KEYS = ['singleMicros', 'dayMicros', 'monthMicros', 'experimentMicros'];
const jsonConfig = (raw, keys) => {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 8192) throw unavailable();
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || typeof value !== 'object'
    || Object.keys(value).length !== keys.length || !keys.every(k => Object.hasOwn(value, k))) throw unavailable();
  return Object.freeze(value);
};
const validateProfile = profile => C.buildPreview({ input: {}, chapter: {} }, profile, Date.now());

function createAi1Runtime({ env = process.env, connection = mongoose.connection } = {}) {
  try {
    const mode = env.AI1_MODE === undefined ? 'off' : env.AI1_MODE;
    if (!['off', 'query-only', 'enabled', 'store-isolated'].includes(mode)) throw unavailable();
    const active = mode === 'enabled' || mode === 'query-only';
    let ready = !active, profile = null, limits = null, operationClient;
    if (active) {
      if (connection !== mongoose.connection || Object.values(M).some(m => m.db !== connection)
        || env.AI1_LOCAL_STORE_CONTINUOUS !== 'true' || env.AI1_REMOTE_STORE_CONTINUOUS !== 'true') throw unavailable();
      // These are operator prerequisites, not automatic backup-rollback detection.
      const token = env.AI1_OPERATION_TOKEN;
      for (const key of ['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET', 'INTERNAL_SERVICE_TOKEN',
        'MEDIA_REFERENCE_SERVICE_TOKEN', 'COMPLETION_RETIREMENT_SERVICE_TOKEN']) {
        if (token && token === env[key]) throw unavailable();
      }
      if (env.AI1_ALLOW_LOOPBACK !== undefined && !['true', 'false'].includes(env.AI1_ALLOW_LOOPBACK)) throw unavailable();
      if (env.AI1_ALLOW_LOOPBACK === 'true' && env.NODE_ENV !== 'test') throw unavailable();
      const client = createOperationClient({ baseUrl: env.AI1_OPERATION_URL, token,
        allowLoopback: env.NODE_ENV === 'test' && env.AI1_ALLOW_LOOPBACK === 'true' });
      operationClient = mode === 'query-only' ? Object.freeze({ get: client.get }) : Object.freeze(client);
      if (mode === 'enabled') {
        if (env.AI1_PROVIDER_PROFILE_CONFIRMED !== 'true') throw unavailable();
        profile = jsonConfig(env.AI1_MODEL_PROFILE, PROFILE_KEYS);
        limits = jsonConfig(env.AI1_BUDGET_LIMITS, BUDGET_KEYS);
        if (!Object.values(limits).every(C.integer)) throw unavailable();
        validateProfile(profile);
      }
    }
    const assertReady = async () => {
      if (!active) return;
      ready = false;
      try {
        await assertTransactionCapability({ db: { admin: () => ({
          command: query => connection.db.admin().command(query, { maxTimeMS: 5000, readPreference: 'primary' })
        }) } }, 'AI1');
        await assertAi1Indexes();
        if (profile) validateProfile(profile);
        ready = true;
      } catch { throw unavailable(); }
    };
    return { mode, assertReady, dependencies: {
      getRuntime: () => {
        if (!ready) throw unavailable();
        return { enabled: mode === 'enabled', continuousStore: active };
      },
      getProfile: () => profile ? { ...profile } : null,
      getLimits: () => limits ? { ...limits } : null,
      operationClient
    } };
  } catch { throw unavailable(); }
}
module.exports = { createAi1Runtime };

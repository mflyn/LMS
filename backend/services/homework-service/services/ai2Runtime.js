const mongoose = require('mongoose');
const M = require('../models/Ai2');
const A = require('../models/Ai1');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const GrowthTask = require('../models/GrowthTask');
const { validateAi2Environment } = require('../../../common/services/ai2Activation');
const { assertAi2Ready } = require('./ai2Readiness');
const { error } = require('./ai2Contract');

function createAi2Runtime({ env = process.env, connection = mongoose.connection } = {}) {
  validateAi2Environment(env);
  const assertConnection = () => {
    if (connection !== mongoose.connection
      || [...Object.values(M), ...Object.values(A), Family, User, GrowthTask].some(model => model.db !== connection)) {
      throw error(503, 'AI2_NOT_READY');
    }
  };
  assertConnection();
  let ready = false;
  const assertReady = async () => {
    ready = false;
    const { continuousStore } = validateAi2Environment(env);
    if (!continuousStore) return;
    try {
      assertConnection();
      await assertAi2Ready();
      ready = true;
    } catch { throw error(503, 'AI2_NOT_READY'); }
  };
  return { assertReady, dependencies: { getRuntime: () => {
    const { mode, continuousStore } = validateAi2Environment(env);
    if (!continuousStore) return { enabled: false, continuousStore: false };
    assertConnection();
    if (!ready || connection.readyState !== 1) throw error(503, 'AI2_NOT_READY');
    return { enabled: mode === 'enabled', continuousStore: true };
  } } };
}

module.exports = { createAi2Runtime };

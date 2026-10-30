const modules = {
  user: ['common/models/Role', 'common/models/User', 'common/models/Family', 'common/models/FamilyParentInvitation', 'common/models/FamilyMembershipEvent'],
  progress: ['GrowthLog', 'StarLedgerEntry', 'StarLedgerGuard', 'Reward', 'KnowledgePoint', 'KnowledgePointMasteryEvent'].map(n => `services/progress-service/models/${n}`),
  homework: ['GrowthTask', 'DailyLearningPlan', 'GrowthTaskCompletionOperation', 'CompletionMediaGuard'].map(n => `services/homework-service/models/${n}`),
  resource: ['MediaAsset', 'MediaReference', 'MediaReferenceOperation', 'MediaDeletionReceipt', 'MediaDeletionTombstone', 'CompletionUploadGuard', 'MediaOrphanRetirement'].map(n => `services/resource-service/models/${n}`),
  analytics: ['FamilyMistake', 'FamilyMistakeStateEvent', 'WeeklyReport'].map(n => `services/analytics-service/models/${n}`),
  notification: ['ReminderSettings', 'Notification'].map(n => `services/notification-service/models/${n}`)
};

// This is only sent to a newly-created, labelled synthetic container. Never a migration.
async function runPreparation({ env, mongoose, load, fs }) {
  if (env.MONGO_URI !== 'mongodb://mongo:27017/learning-tracker?replicaSet=rs0') throw Error('WRONG_SYNTHETIC_URI');
  const service = env.SYNTHETIC_PREPARATION;
  if (service === 'storage') {
    for (const dir of [env.PRIVATE_MEDIA_ROOT, env.COMPLETION_DELETION_JOURNAL_ROOT]) {
      const stat = await fs.lstat(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700
        || (await fs.readdir(dir)).length) throw Error('NOT_EMPTY_PRIVATE_VOLUME');
    }
    await load('services/resource-service/services/completionStorageReadiness')
      .assertCompletionStorageReadiness({ env });
    return;
  }
  if (service !== 'fresh' && !modules[service] && !['preflight-homework', 'preflight-resource'].includes(service)) {
    throw Error('UNKNOWN_PREPARATION');
  }
  mongoose.set('autoCreate', false); mongoose.set('autoIndex', false);
  try {
    await mongoose.connect(env.MONGO_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000 });
    if (service === 'fresh') {
      const db = mongoose.connection.db;
      if ((await db.listCollections().toArray()).some(c => c.name !== 'roles')) throw Error('DATABASE_NOT_FRESH');
      const roles = await db.collection('roles').find({}).toArray();
      if (roles.length !== 2 || roles.map(r => r.name).sort().join() !== 'parent,student') throw Error('ROLES_NOT_SYNTHETIC');
    } else if (modules[service]) {
      for (const name of modules[service]) {
        const Model = load(name);
        if (Model.db !== mongoose.connection) throw Error('MODEL_CONNECTION_MISMATCH');
        const count = await Model.collection.countDocuments({});
        if (count !== 0 && !(service === 'user' && Model.collection.name === 'roles' && count === 2)) throw Error('COLLECTION_NOT_EMPTY');
        await Model.createCollection(); await Model.createIndexes();
      }
    } else {
      const options = { connection: mongoose.connection, writesPaused: true, env };
      if (service === 'preflight-homework') {
        await load('services/homework-service/services/growthTaskCompletionReadiness').assertGrowthTaskCompletionReadiness(options);
        load('common/middleware/completionRetirementCredential').createCompletionRetirementCredential(env);
        await load('services/homework-service/services/completionMediaGuardReadiness').assertCompletionMediaGuardReadiness(options);
      } else {
        await load('services/resource-service/services/completionOperations').checkCompletionOperations(options);
      }
    }
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    if (process.env.MONGO_URI !== 'mongodb://mongo:27017/learning-tracker?replicaSet=rs0') throw Error('WRONG_SYNTHETIC_URI');
    return runPreparation({ env: process.env, mongoose: require('/app/node_modules/mongoose'),
      load: name => require(`/app/backend/${name}`), fs: require('fs/promises') });
  })
    .then(() => console.log(`Synthetic preparation passed: ${process.env.SYNTHETIC_PREPARATION}`))
    .catch(() => { console.error('SYNTHETIC_PREPARATION_FAILED'); process.exitCode = 1; });
}
module.exports = { runPreparation };

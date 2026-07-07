const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { createFamilyReadRepository } = require('../familyReadRepository');

const FAMILY_A_ID = new mongoose.Types.ObjectId('665000000000000000000001');
const FAMILY_B_ID = new mongoose.Types.ObjectId('665000000000000000000002');
const CHILD_A1_ID = new mongoose.Types.ObjectId('665000000000000000000011');
const CHILD_B1_ID = new mongoose.Types.ObjectId('665000000000000000000021');
const CUTOFF = new Date('2026-06-29T00:00:00.000Z');

let mongoServer;
let connection;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  connection = mongoose.createConnection(mongoServer.getUri());
  await connection.asPromise();
});

afterAll(async () => {
  if (connection) await connection.close();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  const collections = await connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

const seedProjectionSources = async () => {
  await connection.collection('growthtasks').insertMany([
    {
      _id: new mongoose.Types.ObjectId('666000000000000000000001'),
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      dimension: 'physical',
      area: '跳绳',
      title: '连续跳绳',
      status: 'completed',
      dueDate: '2026-06-24',
      estimatedMinutes: 20,
      actualMinutes: 18,
      cancelledAt: new Date('2026-06-30T00:00:00.000Z'),
      createdAt: new Date('2026-06-23T00:00:00.000Z')
    },
    {
      _id: new mongoose.Types.ObjectId('666000000000000000000002'),
      familyId: FAMILY_B_ID,
      childId: CHILD_B1_ID,
      dimension: 'physical',
      area: '跳绳',
      title: 'other family',
      status: 'completed',
      dueDate: '2026-06-24',
      createdAt: new Date('2026-06-23T00:00:00.000Z')
    }
  ]);
  await connection.collection('growthlogs').insertOne({
    _id: new mongoose.Types.ObjectId('666000000000000000000011'),
    familyId: FAMILY_A_ID,
    childId: CHILD_A1_ID,
    date: '2026-06-25',
    dimension: 'labor',
    area: '家务',
    content: '整理房间',
    durationMinutes: 30,
    createdAt: new Date('2026-06-25T00:00:00.000Z')
  });
  await connection.collection('knowledgepoints').insertOne({
    _id: new mongoose.Types.ObjectId('666000000000000000000021'),
    familyId: FAMILY_A_ID,
    childId: CHILD_A1_ID,
    dimension: 'academic',
    subject: '数学',
    name: '分数',
    masteryLevel: 'learning',
    createdAt: new Date('2026-06-20T00:00:00.000Z')
  });
  await connection.collection('knowledgepointmasteryevents').insertMany([
    {
      _id: new mongoose.Types.ObjectId('666000000000000000000031'),
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      knowledgePointId: new mongoose.Types.ObjectId('666000000000000000000021'),
      dimension: 'academic',
      subject: '数学',
      name: '分数',
      masteryLevel: 'learning',
      effectiveAt: new Date('2026-06-21T00:00:00.000Z'),
      operationId: 'kp-learning'
    },
    {
      _id: new mongoose.Types.ObjectId('666000000000000000000032'),
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      knowledgePointId: new mongoose.Types.ObjectId('666000000000000000000021'),
      dimension: 'academic',
      subject: '数学',
      name: '分数',
      masteryLevel: 'skilled',
      effectiveAt: new Date('2026-07-01T00:00:00.000Z'),
      operationId: 'after-cutoff'
    }
  ]);
  await connection.collection('familymistakes').insertOne({
    _id: new mongoose.Types.ObjectId('666000000000000000000041'),
    familyId: FAMILY_A_ID,
    childId: CHILD_A1_ID,
    dimension: 'academic',
    subject: '数学',
    reason: 'careless',
    reviewed: false,
    mastered: false,
    reviewReminderDate: '2026-06-26',
    createdAt: new Date('2026-06-22T00:00:00.000Z')
  });
  await connection.collection('familymistakestateevents').insertOne({
    _id: new mongoose.Types.ObjectId('666000000000000000000051'),
    familyId: FAMILY_A_ID,
    childId: CHILD_A1_ID,
    mistakeId: new mongoose.Types.ObjectId('666000000000000000000041'),
    reviewed: true,
    mastered: false,
    reviewReminderDate: '2026-06-26',
    effectiveAt: new Date('2026-06-27T00:00:00.000Z'),
    operationId: 'mistake-reviewed'
  });
};

const scoped = () => ({
  familyId: FAMILY_A_ID.toString(),
  childId: CHILD_A1_ID.toString(),
  from: '2026-06-22',
  to: '2026-06-28',
  cutoff: CUTOFF,
  timeoutMs: 20
});

describe('family read repository', () => {
  test('TC-T6-REPO-001 rejects unscoped task reads before querying', async () => {
    const collection = jest.fn();
    const repository = createFamilyReadRepository({ connection: { collection }, timeoutMs: 20 });

    await expect(repository.listTaskProjection({
      childId: CHILD_A1_ID.toString(),
      from: '2026-06-22',
      to: '2026-06-28',
      cutoff: CUTOFF,
      timeoutMs: 20
    })).rejects.toMatchObject({ code: 'UNSCOPED_FAMILY_READ' });
    expect(collection).not.toHaveBeenCalled();
  });

  test('TC-T6-REPO-002 through TC-T6-REPO-005 returns bounded projections with cutoff history', async () => {
    await seedProjectionSources();
    const repository = createFamilyReadRepository({ connection, timeoutMs: 20 });

    await expect(repository.listTaskProjection(scoped())).resolves.toEqual([
      expect.objectContaining({
        taskId: '666000000000000000000001',
        dimension: 'physical',
        title: '连续跳绳',
        cancelledAt: new Date('2026-06-30T00:00:00.000Z')
      })
    ]);
    await expect(repository.listGrowthLogProjection(scoped())).resolves.toEqual([
      expect.objectContaining({ logId: '666000000000000000000011', dimension: 'labor', content: '整理房间' })
    ]);
    await expect(repository.listKnowledgePointProjection(scoped())).resolves.toEqual([
      expect.objectContaining({ knowledgePointId: '666000000000000000000021', masteryLevel: 'learning' })
    ]);
    await expect(repository.listKnowledgePointMasteryEventProjection(scoped())).resolves.toEqual([
      expect.objectContaining({ operationId: 'kp-learning', masteryLevel: 'learning' })
    ]);
    await expect(repository.listMistakeProjection(scoped())).resolves.toEqual([
      expect.objectContaining({ mistakeId: '666000000000000000000041', reason: 'careless' })
    ]);
    await expect(repository.listMistakeStateEventProjection(scoped())).resolves.toEqual([
      expect.objectContaining({ operationId: 'mistake-reviewed', reviewed: true })
    ]);
  });

  test('TC-T6-REPO-006 normalizes source timeout and generic source errors', async () => {
    const timeoutConnection = {
      collection: () => ({
        find: () => ({
          maxTimeMS: () => ({
            toArray: async () => {
              const error = new Error('operation exceeded time limit');
              error.code = 50;
              throw error;
            }
          })
        })
      })
    };
    const sourceConnection = {
      collection: () => ({
        find: () => ({
          maxTimeMS: () => ({
            toArray: async () => {
              throw new Error('database unavailable');
            }
          })
        })
      })
    };

    await expect(createFamilyReadRepository({ connection: timeoutConnection }).listTaskProjection(scoped()))
      .rejects.toMatchObject({ code: 'FAMILY_READ_TIMEOUT', source: 'growthtasks' });
    await expect(createFamilyReadRepository({ connection: sourceConnection }).listTaskProjection(scoped()))
      .rejects.toMatchObject({ code: 'FAMILY_READ_SOURCE_UNAVAILABLE', source: 'growthtasks' });
  });

  test('TC-T6-REPO-006 does not import service-private models', () => {
    const repositoryPath = path.join(__dirname, '..', 'familyReadRepository.js');
    const source = fs.readFileSync(repositoryPath, 'utf8');

    expect(source).not.toMatch(new RegExp('services/(analytics|homework|progress)-service/models'));
    expect(source).not.toMatch(/require\([^)]*FamilyMistake/);
    expect(source).not.toMatch(/require\([^)]*GrowthTask/);
    expect(source).not.toMatch(/require\([^)]*KnowledgePoint/);
  });
});

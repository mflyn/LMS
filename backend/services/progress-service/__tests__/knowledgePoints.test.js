const mongoose = require('mongoose');

const owner = () => ({
  familyId: new mongoose.Types.ObjectId(),
  childId: new mongoose.Types.ObjectId(),
  createdByParentId: new mongoose.Types.ObjectId(),
  updatedByParentId: new mongoose.Types.ObjectId()
});

describe('Task 5 knowledge and ability points', () => {
  test('TC-T5-POINT-001 accepts academic subject and non-academic area points', async () => {
    const KnowledgePoint = require('../models/KnowledgePoint');
    const academic = await KnowledgePoint.create({
      ...owner(), dimension: 'academic', subject: '数学', name: '分数计算'
    });
    const physical = await KnowledgePoint.create({
      ...owner(), dimension: 'physical', area: '跳绳', name: '连续跳绳'
    });

    expect(academic.area).toBe('');
    expect(physical.subject).toBe('');
  });

  test('TC-T5-POINT-002 rejects missing conditional fields and invalid counters', async () => {
    const KnowledgePoint = require('../models/KnowledgePoint');
    await expect(new KnowledgePoint({
      ...owner(), dimension: 'academic', name: 'missing subject'
    }).validate()).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(new KnowledgePoint({
      ...owner(), dimension: 'labor', name: 'missing area', practiceCount: -1.5
    }).validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('TC-T5-POINT-003 enforces normalized per-child uniqueness', async () => {
    const KnowledgePoint = require('../models/KnowledgePoint');
    await KnowledgePoint.syncIndexes();
    const fields = {
      ...owner(), dimension: 'academic', subject: '数学', area: '', name: '分数计算'
    };
    await KnowledgePoint.create(fields);
    await expect(KnowledgePoint.create({ ...fields, updatedByParentId: new mongoose.Types.ObjectId() }))
      .rejects.toMatchObject({ code: 11000 });
  });
});

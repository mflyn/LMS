const mongoose = require('mongoose');

const ids = () => ({
  familyId: new mongoose.Types.ObjectId(),
  childId: new mongoose.Types.ObjectId(),
  actorId: new mongoose.Types.ObjectId()
});

describe('Task 5 growth logs', () => {
  test('TC-T5-LOG-001 accepts all five dimensions with LocalDate ownership', async () => {
    const GrowthLog = require('../models/GrowthLog');
    const dimensions = ['moral', 'academic', 'physical', 'artistic', 'labor'];

    for (const dimension of dimensions) {
      const owner = ids();
      const log = await GrowthLog.create({
        ...owner,
        createdBy: owner.actorId,
        updatedBy: owner.actorId,
        date: '2026-06-19',
        dimension,
        content: `${dimension} activity`
      });
      expect(log.dimension).toBe(dimension);
      expect(log.date).toBe('2026-06-19');
    }
  });

  test('TC-T5-LOG-002 rejects invalid dates, values, enums and content', async () => {
    const GrowthLog = require('../models/GrowthLog');
    const owner = ids();
    const base = {
      ...owner,
      createdBy: owner.actorId,
      updatedBy: owner.actorId,
      date: '2026-02-30',
      dimension: 'unknown',
      content: 'x'.repeat(1001),
      durationMinutes: -1,
      amount: -1
    };

    await expect(new GrowthLog(base).validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });
});

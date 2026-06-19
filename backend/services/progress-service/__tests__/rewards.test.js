const mongoose = require('mongoose');

describe('Task 5 rewards', () => {
  test('TC-T5-REWARD-002 validates title and positive integer star cost', async () => {
    const Reward = require('../models/Reward');
    const base = {
      familyId: new mongoose.Types.ObjectId(),
      childId: new mongoose.Types.ObjectId(),
      createdByParentId: new mongoose.Types.ObjectId(),
      title: '',
      requiredStars: 1.5
    };

    await expect(new Reward(base).validate()).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(new Reward({ ...base, title: 'x'.repeat(101), requiredStars: 0 }).validate())
      .rejects.toMatchObject({ name: 'ValidationError' });
  });
});

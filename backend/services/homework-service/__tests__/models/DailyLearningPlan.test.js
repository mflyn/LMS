const mongoose = require('mongoose');
const Plan = require('../../models/DailyLearningPlan');
const id = () => new mongoose.Types.ObjectId();
const base = () => ({ familyId: id(), childId: id(), localDate: '2026-10-26', version: 1, items: [] });
test.each([null, 1, 240])('model accepts optional or bounded estimate %s', async minutes => {
  await expect(new Plan({ ...base(), items: [{ taskId: id(), childEstimatedMinutes: minutes }] }).validate()).resolves.toBeUndefined();
});
test.each([0, 241, 1.5, Infinity, NaN])('model rejects estimate %s', async minutes => {
  await expect(new Plan({ ...base(), items: [{ taskId: id(), childEstimatedMinutes: minutes }] }).validate()).rejects.toThrow();
});
test('model rejects duplicate, over-limit, invalid date and invalid persisted version', async () => {
  const taskId = id();
  for (const extra of [{ items: [{ taskId }, { taskId }] }, { items: Array.from({ length: 21 }, () => ({ taskId: id() })) },
    { localDate: '2026-02-30' }, { version: 0 }, { version: 1.5 }, { version: Number.MAX_SAFE_INTEGER + 1 }]) {
    await expect(new Plan({ ...base(), ...extra }).validate()).rejects.toThrow();
  }
  await expect(new Plan({ ...base(), items: Array.from({ length: 20 }, () => ({ taskId: id() })) }).validate()).resolves.toBeUndefined();
});
test('physical unique index separates family, child and local date', async () => {
  await Plan.init(); const first = base(); await Plan.create(first);
  await expect(Plan.create(first)).rejects.toMatchObject({ code: 11000 });
  await Plan.create({ ...first, familyId: id() }); await Plan.create({ ...first, childId: id() });
  await Plan.create({ ...first, localDate: '2026-10-25' }); expect(await Plan.countDocuments()).toBe(4);
});

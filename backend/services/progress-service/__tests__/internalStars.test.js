const mongoose = require('mongoose');

describe('Task 5 internal stars', () => {
  test('TC-T5-STAR-007 ledger entries reject update and document delete', async () => {
    const StarLedgerEntry = require('../models/StarLedgerEntry');
    const entry = await StarLedgerEntry.create({
      familyId: new mongoose.Types.ObjectId(),
      childId: new mongoose.Types.ObjectId(),
      type: 'earn',
      amount: 1,
      sourceType: 'task_confirmation',
      sourceId: new mongoose.Types.ObjectId().toString(),
      createdBy: 'homework-service'
    });

    entry.amount = 99;
    await expect(entry.save()).rejects.toMatchObject({ code: 'IMMUTABLE_LEDGER_ENTRY' });
    await expect(entry.deleteOne()).rejects.toMatchObject({ code: 'IMMUTABLE_LEDGER_ENTRY' });
  });
});

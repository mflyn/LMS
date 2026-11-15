const assert = require('node:assert/strict');
const C = require('../../../backend/common/services/ai3ReviewEvidence');

const tables = [
  ['mistake', 'Mistake', 'Ai3MistakeReceipt', 'MistakeStateEvent'],
  ['knowledgePoint', 'KnowledgePoint', 'Ai3MasteryReceipt', 'KnowledgePointMasteryEvent']
];
const receiptKeys = ['effectId', 'finalReviewId', 'finalReviewHash', 'familyId', 'childId', 'targetId',
  'reviewedByParentId', 'expectedStateRevision', 'status', 'reviewedAt', 'appliedAt', 'decidedAt', 'eventId'];
const equalFields = (actual, expected, label) => {
  for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value, `${label}.${field}`);
};
const one = (rows, label) => { assert.equal(rows.length, 1, `${label}: expected exactly one row`); return rows[0]; };

// Reads the isolated runtime's JSON snapshot; it never loads models or mutates evidence.
function assertAi3AppliedEffects(snapshot, command, actorId) {
  const saved = JSON.parse(JSON.stringify(command));
  const review = C.validateFinalReview(saved.finalReview);
  equalFields(saved, { _id: review.id, familyId: review.familyId, childId: review.childId,
    roundId: review.roundId, actorId, endpointOperation: 'ai3.review', finalReviewHash: C.hash(review) }, 'command');
  assert.equal(review.reviewedByParentId, actorId, 'finalReview.reviewedByParentId');
  const scope = { familyId: review.familyId, childId: review.childId };
  const audit = { finalReviewId: review.id, finalReviewHash: saved.finalReviewHash,
    reviewedByParentId: actorId, reviewedAt: review.reviewedAt };

  for (const [kind, targetTable, receiptTable, eventTable] of tables) {
    for (const table of [targetTable, receiptTable, eventTable]) {
      assert.ok(Array.isArray(snapshot?.database?.[table]), `snapshot.${table} must be an array`);
    }
    const targets = snapshot.database[targetTable], receipts = snapshot.database[receiptTable], events = snapshot.database[eventTable];
    const target = review.targets[kind];
    const eventReviewId = event => kind === 'mistake' ? event.ai3Evidence?.finalReviewId : event.finalReviewId;
    if (!target) {
      assert.equal(receipts.filter(row => row.finalReviewId === review.id).length, 0, `${kind}.receipt: unrequested effect`);
      assert.equal(events.filter(row => eventReviewId(row) === review.id).length, 0, `${kind}.event: unrequested effect`);
      continue;
    }
    const request = { schemaVersion: 'ai3-review-effect-v1', effectId: target.effectId,
      finalReviewId: review.id, finalReviewHash: saved.finalReviewHash, ...scope,
      reviewedByParentId: actorId, targetId: target.id, expectedStateRevision: target.stateRevision };
    // Include both identities so a duplicate cannot hide behind a different review or scope.
    const receipt = one(receipts.filter(row => row.finalReviewId === review.id || row.effectId === target.effectId), `${kind}.receipt`);
    const dto = Object.fromEntries(receiptKeys.map(key => [key, receipt[key]]));
    assert.doesNotThrow(() => C.validateReceipt(dto, request), `${kind}.receipt contract`);
    equalFields(receipt, { status: 'applied', requestHash: C.hash(request), reviewedAt: review.reviewedAt }, `${kind}.receipt`);
    const eventOperation = kind === 'mistake' ? `ai3:${target.effectId}` : target.effectId;
    const event = one(events.filter(row => row._id === receipt.eventId || eventReviewId(row) === review.id
      || row.operationId === eventOperation || (kind === 'mistake' && row.ai3Evidence?.effectId === target.effectId)), `${kind}.event`);
    equalFields(event, { _id: receipt.eventId, ...scope, operationId: eventOperation,
      effectiveAt: receipt.appliedAt }, `${kind}.event`);
    equalFields(kind === 'mistake' ? event.ai3Evidence || {} : event,
      { ...audit, ...(kind === 'mistake' ? { effectId: target.effectId } : {}) }, `${kind}.event.audit`);

    const row = one(targets.filter(value => value._id === target.id), `${kind}.target`);
    equalFields(row, scope, `${kind}.target`);
    assert.ok(Number.isSafeInteger(target.stateRevision + 1), `${kind}.target.stateRevision overflow`);
    assert.equal(row.stateRevision, target.stateRevision + 1, `${kind}.target.stateRevision`);
    assert.ok(typeof row.subject === 'string'
      && ['math', '\u6570\u5b66'].includes(row.subject.trim().replace(/[A-Z]/g, c => c.toLowerCase())), `${kind}.target.subject`);
    if (kind === 'knowledgePoint') {
      equalFields(row, { dimension: 'academic', masteryLevel: 'skilled', updatedByParentId: actorId }, `${kind}.target`);
      equalFields(event, { knowledgePointId: target.id, sourceType: 'ai3_practice', masteryLevel: 'skilled',
        dimension: row.dimension, subject: row.subject, area: row.area || '', name: row.name }, `${kind}.event`);
    } else {
      equalFields(row, { reviewed: true, updatedBy: actorId }, `${kind}.target`);
      assert.equal(row.knowledgePointId || null, target.knowledgePointId, 'mistake.target.knowledgePointId');
      assert.equal(typeof row.mastered, 'boolean', 'mistake.target.mastered');
      if (review.masteryConfirmed) assert.equal(row.mastered, true, 'mistake.target.mastered');
      if (review.reviewReminderDate !== null) assert.equal(row.reviewReminderDate, review.reviewReminderDate, 'mistake.target.reviewReminderDate');
      // A false mastery confirmation and a null reminder do not reset prior state.
      equalFields(event, { mistakeId: target.id, reviewed: row.reviewed, mastered: row.mastered,
        reviewReminderDate: row.reviewReminderDate }, 'mistake.event');
    }
  }
}

module.exports = { assertAi3AppliedEffects };
